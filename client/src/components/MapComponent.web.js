import React, {useContext, useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import Formulario from "./Formulario";
import "leaflet/dist/leaflet.css";
import { MarkersContext } from "../context/MakersContext";
import { Polyline } from "react-leaflet";

// Ícones customizados
const mercadoIcon = new L.Icon({
  iconUrl: "/icons/mercado.png",
  iconSize: [20, 20],
  iconAnchor: [17, 35],
});

const produtorIcon = new L.Icon({
  iconUrl: "/icons/produtor.png",
  iconSize: [20, 20],
  iconAnchor: [17, 35],
});

const industriaIcon = new L.Icon({
  iconUrl: "/icons/circle.png",
  iconSize: [60, 60],
  iconAnchor: [17, 35],
});

// Componente para capturar clique no mapa
function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

export default function MapComponent({ importedMarkers = [] , markerOtimo}) {
  const [showForm, setShowForm] = useState(false);
  const [markerType, setMarkerType] = useState("mercado");
  const [newMarkerCoords, setNewMarkerCoords] = useState(null);
  const { markers, setMarkers } = useContext(MarkersContext);
  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState(null);
  const [frutas, setFrutas] = useState(null);

  useEffect(() => {
    setMarkers(importedMarkers);
  }, [importedMarkers]);

  const handleSave = (data) => {
    const quantidadeNumerica = parseInt(data.quantidade, 10);
    if (selectedMarkerIndex !== null) {
      // Atualiza marcador existente
      const updatedMarkers = [...markers];
      updatedMarkers[selectedMarkerIndex] = { 
        type: data.tipo, 
        coords: data.coords, 
        frutas: data.frutas, 
        quantidade: quantidadeNumerica
      };
      setMarkers(updatedMarkers);
    } else {
      // Adiciona novo marcador
      setMarkers([...markers, { type: data.tipo, coords: data.coords, frutas: data.frutas, quantidade: quantidadeNumerica }]);
    }
    setSelectedMarkerIndex(null);
    setShowForm(false);
  };

  const handleDelete = () => {
    if (selectedMarkerIndex !== null) {
      setMarkers(markers.filter((_, i) => i !== selectedMarkerIndex));
      setSelectedMarkerIndex(null);
    }
    setShowForm(false);
  };
  return (
    <>
      <div style={{ height: "80vh", width: "80vw" }}>
        <MapContainer center={[-24.61, -51.57]} zoom={7} style={{ height: "100%", width: "100%", borderRadius: 10, borderWidth: 2, borderColor: "#fff",}}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />

          {markers.map((m, i) => (
            <Marker
              key={i}
              position={[m.coords.lat, m.coords.lng]}
              icon={m.type === "mercado" ? mercadoIcon : produtorIcon}
              eventHandlers={{
                click: () => {
                  setSelectedMarkerIndex(i);
                  setNewMarkerCoords(m.coords);
                  setFrutas(m.frutas)
                  setMarkerType(m.type);
                  setShowForm(true);
                },
              }}
            >
              {/* <Popup>
                {m.type} <br />
                Frutas: {m.frutas ? m.frutas.join(", ") : "-"}
              </Popup> */}
            </Marker>
          ))}
          {markerOtimo && 
            <Marker
              key={"markerOtimo"}
              position={[markerOtimo.optimal_location_coord.lat, markerOtimo.optimal_location_coord.lng]}
              icon={industriaIcon}

            >
            <Popup>
                Latitude:{markerOtimo.optimal_location_coord.lat.toFixed(6)} <br />
                Longitude: {markerOtimo.optimal_location_coord.lng.toFixed(6)} <br />
                Custo total R$ {markerOtimo.total_cost}
              </Popup>
            </Marker>
          }
          {markerOtimo?.routes?.map((route, i) => (
            <Polyline
              key={`route-${i}`}
              positions={route}
              pathOptions={{ color: "blue", weight: 3, opacity: 0.7 }}
            />
          ))}

          <ClickHandler
            onClick={(coords) => {
              setSelectedMarkerIndex(null);
              setFrutas(null);
              setNewMarkerCoords(coords);
              setMarkerType("mercado");
              setShowForm(true);
            }}
          />
        </MapContainer>
      </div>

      {showForm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div>
            <Formulario
              markerType={markerType}
              coords={newMarkerCoords}
              frutas={frutas}
              onClose={() => setShowForm(false)}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          </div>
        </div>
      )}
    </>
  );
}
