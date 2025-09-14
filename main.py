"""
optimal_location.py

Versão atualizada: paralelização das avaliações do GA, validações mais robustas para evitar 400 Bad Request
(e mensagens de erro mais informativas), e otimizações pequenas (busca de nó mais próximo vetorizada).

Principais alterações:
- Normalização dos tipos do marcador (aceita 'produtor'/'mercado' e 'producer'/'buyer').
- Validação explícita dos campos do marcador com erros HTTP claros (evita 400 genérico).
- Paralelização do passo de avaliação da população no GA usando ThreadPoolExecutor (paraleliza fitness ao avaliar uma população grande).
- Mensagens de erro mais descritivas em todos os pontos críticos.

Requisitos: geopandas, networkx, shapely, pyproj, fastapi, pydantic

Exemplo rápido de payload JSON (test):
[
  {"type":"produtor","coords":{"lat":-23.5,"lng":-46.6},"frutas":[],"quantidade":"10"},
  {"type":"mercado","coords":{"lat":-23.55,"lng":-46.65},"frutas":[],"quantidade":"8"}
]

"""

import math
import random
import networkx as nx
import geopandas as gpd
from shapely.geometry import Point
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, validator
from typing import List, Tuple, Dict, Any
from fastapi.middleware.cors import CORSMiddleware
from pyproj import Transformer
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import hashlib
import json

# --- CRS transformers ---
to3857 = Transformer.from_crs('EPSG:4326', 'EPSG:3857', always_xy=True)
to4326 = Transformer.from_crs('EPSG:3857', 'EPSG:4326', always_xy=True)

# --- API Models com validação ---
class FrontendCoords(BaseModel):
    lat: float
    lng: float

class FrontendMarker(BaseModel):
    type: str
    coords: FrontendCoords
    frutas: List[str]
    quantidade: int

    @validator('type')
    def normalize_type(cls, v):
        if not isinstance(v, str):
            raise ValueError('type precisa ser uma string')
        t = v.strip().lower()
        if t in ('produtor', 'producer'):
            return 'produtor'
        if t in ('mercado', 'market', 'buyer'):
            return 'mercado'
        raise ValueError("type inválido: use 'produtor' ou 'mercado'")

    @validator('quantidade')
    def validate_quantidade(cls, v):
        try:
            iv = int(v)
            if iv < 0:
                raise ValueError('quantidade deve ser >= 0')
            return str(iv)
        except Exception:
            raise ValueError('quantidade deve ser um inteiro em formato de string')

class Producer(BaseModel):
    id: str
    coord: Tuple[float, float]
    quantidade: int

class Buyer(BaseModel):
    id: str
    coord: Tuple[float, float]
    demanda: int

# --- Configurações de custo ---
PRECO_POR_KM = 3.09
MULTIPLICADORES = {'paved': 1.0, 'gravel': 1.3, 'dirt': 1.6}
CUSTO_CC = 274.71

# --- Carrega malha e monta grafo ---
try:
    malha = gpd.read_file("rodovia_2014_refeita.shp").to_crs(epsg=3857)
except Exception as e:
    raise RuntimeError("Erro ao carregar 'odovia_2014_refeita1.shp': {}".format(e))

G = nx.Graph()

def _distance_meters(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return math.hypot(a[0]-b[0], a[1]-b[1])

def add_edges_from_coords(coords: List[Tuple[float, float]], road_type: str = 'paved'):
    multiplier = MULTIPLICADORES.get(road_type, 1.2)
    for i in range(len(coords) - 1):
        start = tuple(coords[i])
        end = tuple(coords[i + 1])
        distance_m = _distance_meters(start, end)
        distance_km = distance_m / 1000.0
        cost = distance_km * PRECO_POR_KM * multiplier
        G.add_edge(start, end, weight=cost, length_km=distance_km, cc=CUSTO_CC)

for _, row in malha.iterrows():
    road_type = row.get('road_type', 'paved')
    geom = row['geometry']
    if geom is None:
        continue
    if geom.geom_type == 'LineString':
        add_edges_from_coords(list(geom.coords), road_type)
    elif geom.geom_type == 'MultiLineString':
        for line in geom.geoms:
            add_edges_from_coords(list(line.coords), road_type)

# --- Indexação dos nós em arrays para busca vetorizada ---
road_nodes = [n for n in G.nodes if isinstance(n, tuple) and len(n) == 2]
if not road_nodes:
    raise RuntimeError('Nenhum nó de estrada na malha carregada.')
road_nodes_arr = np.array(road_nodes)

# --- Funções utilitárias ---

def connect_to_nearest_node(graph: nx.Graph, point_id: str, coord: Tuple[float, float]) -> Tuple[float, float]:
    # Busca vetorizada: encontra índice do nó de estrada mais próximo via numpy
    pt = np.array(coord)
    deltas = road_nodes_arr - pt
    dists = np.hypot(deltas[:,0], deltas[:,1])
    idx = int(dists.argmin())
    nearest_node = tuple(road_nodes_arr[idx])
    distance_km = dists[idx] / 1000.0
    cost = distance_km * PRECO_POR_KM + CUSTO_CC
    graph.add_node(point_id, coord=coord)
    graph.add_edge(point_id, nearest_node, weight=cost, length_km=distance_km, cc=CUSTO_CC)
    return nearest_node


def hash_markers(markers: List[FrontendMarker]) -> str:
    # Serializa os dados relevantes
    serialized = json.dumps([{
        'type': m.type,
        'coords': {'lat': m.coords.lat, 'lng': m.coords.lng} if m.coords else None,
        'quantidade': m.quantidade
    } for m in markers], sort_keys=True)
    return hashlib.md5(serialized.encode()).hexdigest()



# --- Pré-cálculo de distâncias (serial, estável) ---

def compute_distance_maps(graph: nx.Graph, sources: List[str], targets_filter: set) -> Dict[str, Dict[Any, float]]:
    distances = {}
    for s in sources:
        try:
            lengths = nx.single_source_dijkstra_path_length(graph, s, weight='weight')
        except nx.NetworkXNoPath:
            lengths = {}
        if targets_filter is not None:
            lengths = {k: v for k, v in lengths.items() if k in targets_filter}
        distances[s] = lengths
    return distances

# --- Função de fitness ---

def fitness_from_maps(candidate: Any,
                      producers: List[Producer], buyers: List[Buyer],
                      dist_producers: Dict[str, Dict[Any, float]],
                      dist_buyers: Dict[str, Dict[Any, float]]) -> float:
    total_cost = 0.0
    for p in producers:
        dmap = dist_producers.get(p.id, {})
        if candidate not in dmap:
            return 0.0
        total_cost += dmap[candidate] * p.quantidade
    for b in buyers:
        dmap_b = dist_buyers.get(b.id, {})
        if candidate not in dmap_b:
            return 0.0
        total_cost += dmap_b[candidate] * b.demanda
    return 1.0 / (1.0 + total_cost) if total_cost > 0 else 0.0

# --- GA com paralelização das avaliações ---

def parallel_evaluate(population: List[Any], producers: List[Producer], buyers: List[Buyer],
                      dist_producers: Dict[str, Dict[Any, float]], dist_buyers: Dict[str, Dict[Any, float]],
                      max_workers: int = None) -> List[Tuple[Any, float]]:
    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as exe:
        future_to_ind = {exe.submit(fitness_from_maps, ind, producers, buyers, dist_producers, dist_buyers): ind for ind in population}
        for fut in as_completed(future_to_ind):
            ind = future_to_ind[fut]
            try:
                fit = fut.result()
                if fit > 0:
                    results.append((ind, fit))
            except Exception:
                # Se uma avaliação falhar, ignoramos o indivíduo
                continue
    return results

def genetic_algorithm(graph: nx.Graph, possible_nodes: List[Any], producers: List[Producer], buyers: List[Buyer],
                      generations: int = 1000, population_size: int = 100, mutation_rate: float = 0.01,
                      max_workers: int = None):
    if len(possible_nodes) == 0:
        raise ValueError("Lista de possíveis nós está vazia.")
    population_size = min(population_size, len(possible_nodes))
    possible_set = set(possible_nodes)
    dist_producers = compute_distance_maps(graph, [p.id for p in producers], possible_set)
    dist_buyers = compute_distance_maps(graph, [b.id for b in buyers], possible_set)
    population = random.sample(possible_nodes, population_size)

    for gen in range(generations):
        evaluated = parallel_evaluate(population, producers, buyers, dist_producers, dist_buyers, max_workers=max_workers)
        if not evaluated:
            raise ValueError(f"Nenhum indivíduo válido na geração {gen}.")
        evaluated.sort(key=lambda x: x[1], reverse=True)
        top = [ind for ind, _ in evaluated[: max(2, len(evaluated)//2)]]
        new_pop = []
        while len(new_pop) < population_size:
            if len(top) >= 2:
                p1, p2 = random.sample(top, 2)
            else:
                p1 = p2 = top[0]
            child = random.choice([p1, p2])
            if random.random() < mutation_rate:
                child = random.choice(possible_nodes)
            new_pop.append(child)
        population = new_pop
        best_node_temp, best_fit_temp = max(evaluated, key=lambda x: x[1])
        best_cost_temp = (1.0 / best_fit_temp) - 1.0
        print(f"Na geração {gen} o melhor node foi {best_node_temp} com {best_cost_temp} de custo")


    final_eval = parallel_evaluate(population, producers, buyers, dist_producers, dist_buyers, max_workers=max_workers)
    if not final_eval:
        raise ValueError("Não foi possível encontrar ponto ótimo válido.")
    best_node, best_fit = max(final_eval, key=lambda x: x[1])
    best_cost = (1.0 / best_fit) - 1.0
    return best_node, best_cost

# --- FastAPI app e endpoint ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

cache = {}

@app.post("/find-optimal-location/")
async def find_optimal_location(markers: List[FrontendMarker], request: Request):
    marker_hash = hash_markers(markers)

    if marker_hash in cache:
        return cache[marker_hash]

    
    # Parse e validação
    producers_data: List[Producer] = []
    buyers_data: List[Buyer] = []
    for i, marker in enumerate(markers):
        marker_id = f"{marker.type}-{i}"
        if not hasattr(marker, 'coords') or marker.coords is None:
            raise HTTPException(status_code=400, detail=f"coords ausente no marcador {i}")
        x, y = to3857.transform(marker.coords.lng, marker.coords.lat)
        coord_tuple = (x, y)
        try:
            quantidade_int = int(marker.quantidade)
        except Exception:
            raise HTTPException(status_code=400, detail=f"quantidade inválida no marcador {i}")
        if marker.type == "produtor":
            producers_data.append(Producer(id=marker_id, coord=coord_tuple, quantidade=quantidade_int))
        elif marker.type == "mercado":
            buyers_data.append(Buyer(id=marker_id, coord=coord_tuple, demanda=quantidade_int))

    if not producers_data or not buyers_data:
        raise HTTPException(status_code=400, detail="Você precisa de pelo menos um produtor e um mercado.")

    local_G = G.copy()
    all_point_ids = [p.id for p in producers_data] + [b.id for b in buyers_data]
    
    for p in producers_data:
        connect_to_nearest_node(local_G, p.id, p.coord)
    for b in buyers_data:
        connect_to_nearest_node(local_G, b.id, b.coord)

    # --- This is the new section that connects the components ---
    components = list(nx.connected_components(local_G.to_undirected()))
    
    # Use frozenset to create hashable keys
    producer_components = {frozenset(comp): [p for p in producers_data if p.id in comp] for comp in components}
    buyer_components = {frozenset(comp): [b for b in buyers_data if b.id in comp] for comp in components}

    # Now, find viable components using the frozenset keys
    viable_components_keys = [fcomp for fcomp, prods in producer_components.items() if prods and buyer_components[fcomp]]
    
    if len(viable_components_keys) > 1:
        print("Múltiplos componentes viáveis encontrados. Conectando-os...")
        
        # Lógica para encontrar os nós mais próximos entre componentes
        for i in range(len(viable_components_keys) - 1):
            comp1_key = viable_components_keys[i]
            comp2_key = viable_components_keys[i+1]
            
            # Use os frozenset keys para acessar os componentes originais
            nodes1 = np.array([n for n in comp1_key if isinstance(n, tuple) and len(n) == 2])
            nodes2 = np.array([n for n in comp2_key if isinstance(n, tuple) and len(n) == 2])
            
            if nodes1.size > 0 and nodes2.size > 0:
                from_nodes = np.repeat(nodes1, len(nodes2), axis=0)
                to_nodes = np.tile(nodes2, (len(nodes1), 1))
                dists = np.hypot(from_nodes[:,0] - to_nodes[:,0], from_nodes[:,1] - to_nodes[:,1])
                
                min_idx = dists.argmin()
                idx1 = min_idx // len(nodes2)
                idx2 = min_idx % len(nodes2)
                
                closest_node1 = tuple(nodes1[idx1])
                closest_node2 = tuple(nodes2[idx2])
                
                distance_km = dists[min_idx] / 1000.0
                cost = distance_km * PRECO_POR_KM + CUSTO_CC
                
                print(f"Adicionando aresta entre {closest_node1} e {closest_node2} com custo {cost:.2f}")
                local_G.add_edge(closest_node1, closest_node2, weight=cost, length_km=distance_km, cc=CUSTO_CC)
    
    
    component_nodes = []
    for comp in components:
        comp_producers = [p.id for p in producers_data if p.id in comp]
        comp_buyers = [b.id for b in buyers_data if b.id in comp]
        if comp_producers and comp_buyers:
            component_nodes.append({
                'producers': comp_producers,
                'buyers': comp_buyers,
                'possible_nodes': [n for n in comp if isinstance(n, tuple) and len(n) == 2]
            })

    if not component_nodes:
        raise HTTPException(status_code=400, detail="Nenhum componente contém produtores e mercados conectados.")

    # --- Escolhe o melhor ponto em todos os componentes ---
    best_overall_node = None
    best_overall_cost = float('inf')

    for comp in component_nodes:
        try:
            node, cost = genetic_algorithm(
                local_G,
                comp['possible_nodes'],
                [p for p in producers_data if p.id in comp['producers']],
                [b for b in buyers_data if b.id in comp['buyers']],
                max_workers=None
            )
            if cost < best_overall_cost:
                best_overall_cost = cost
                best_overall_node = node
        except Exception:
            continue

    if best_overall_node is None:
        raise HTTPException(status_code=500, detail="Não foi possível encontrar ponto ótimo em nenhum componente.")

    paths_coords = []
    for p in producers_data + buyers_data:
        try:
            path = nx.shortest_path(local_G, source=p.id, target=best_overall_node, weight='weight')
            coords_path = []
            for node in path:
                if isinstance(node, tuple):
                    lon, lat = to4326.transform(node[0], node[1])
                    coords_path.append([lat, lon])
            paths_coords.append(coords_path)
        except nx.NetworkXNoPath:
            continue

    lon, lat = to4326.transform(best_overall_node[0], best_overall_node[1])
    resultado = {
        'optimal_location_coord': {'lat': lat, 'lng': lon},
        'total_cost': f'{best_overall_cost:.2f}',
        'routes': paths_coords
    }
    cache[marker_hash] = resultado
    return resultado




@app.post("/find-optimal-location-test/")
async def find_optimal_location(markers: List[FrontendMarker], request: Request):
    local_G = G.copy()   
    roads_coords = []
    for u, v in local_G.edges():
        # cada u e v são nós com coordenadas (x, y) em EPSG:3857
        if isinstance(u, tuple) and isinstance(v, tuple):
            lon_u, lat_u = to4326.transform(u[0], u[1])
            lon_v, lat_v = to4326.transform(v[0], v[1])
            # salva cada rodovia como linha entre 2 pontos
            roads_coords.append([[lat_u, lon_u], [lat_v, lon_v]])
    return {
        'optimal_location_coord': {'lat': 20, 'lng': 20},
        'total_cost': f'{20}',
        'routes': roads_coords
    }
