import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, TouchableOpacity, FlatList, StyleSheet } from "react-native";

const frutasDisponiveis = [
  "Maçã", "Banana", "Laranja", "Manga", "Abacaxi",
  "Uva", "Melancia", "Pera", "Mamão", "Limão", "Kiwi"
];

export default function Formulario({ markerType, coords, frutas, onClose, onSave, onDelete }) {
  const [quantidade, setQuantidade] = useState("");
  const [tipo, setTipo] = useState(markerType);
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState([]);


  useEffect(() => {
    setTipo(markerType);
    if (coords && frutas) {
      setSelecionadas(frutas);
    } else {
      setSelecionadas([]);
    }
  }, [markerType, frutas]);


  const frutasFiltradas = frutasDisponiveis.filter(
    (f) => f.toLowerCase().includes(busca.toLowerCase()) && !selecionadas.includes(f)
  );

  const adicionarFruta = (fruta) => {
    setSelecionadas([...selecionadas, fruta]);
    setBusca("");
  };



  const removerFruta = (fruta) => {
    setSelecionadas(selecionadas.filter((f) => f !== fruta));
  };

  const salvar = () => {
    if (onSave) onSave({ tipo, coords, frutas: selecionadas, quantidade});
    onClose();
  };

  const excluir = () => {
    if (onDelete) onDelete();
    onClose();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>CADASTRO DE {tipo === "mercado" ? "MERCADO" : "PRODUTOR"}</Text>
      <Text>Latitude: {coords?.lat.toFixed(6)}</Text>
      <Text>Longitude: {coords?.lng.toFixed(6)}</Text>

      {/* Seletor de tipo */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, tipo === "mercado" && styles.ativo]}
          onPress={() => setTipo("mercado")}
        >
          <Text style={styles.toggleText}>Mercado</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, tipo === "produtor" && styles.ativo]}
          onPress={() => setTipo("produtor")}
        >
          <Text style={styles.toggleText}>Produtor</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Digite a quantidade demandada"
        value={quantidade}
        onChangeText={setQuantidade}
        keyboardType="numeric" // Recomendado para garantir que o usuário digite apenas números
      />

      {/* Campo de busca */}
      <TextInput
        style={styles.input}
        placeholder="Digite a fruta..."
        value={busca}
        onChangeText={setBusca}
      />

      {/* Sugestões */}
      {busca.length > 0 && frutasFiltradas.length > 0 && (
        <FlatList
          style={styles.listaSugestoes}
          data={frutasFiltradas}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => adicionarFruta(item)} style={styles.sugestao}>
              <Text>{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Frutas selecionadas */}
      <View style={styles.frutasContainer}>
        {selecionadas.map((fruta) => (
          <View key={fruta} style={styles.tag}>
            <Text>{fruta}</Text>
            <TouchableOpacity onPress={() => removerFruta(fruta)}>
              <Text style={styles.remover}> ✕ </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <Button title="Salvar" onPress={salvar} />
      <Button title="Cancelar" onPress={onClose} color="gray" />
      {onDelete && <Button title="Excluir" onPress={excluir} color="red" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {backgroundColor: "#d9d9d9", padding: 10, borderRadius: 20, width: "90vw"},
  titulo: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#aaa", padding: 8, marginVertical: 10, borderRadius: 6 },
  listaSugestoes: { maxHeight: 100, marginBottom: 10, borderWidth: 1, borderColor: "#ccc" },
  sugestao: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  frutasContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  tag: { flexDirection: "row", alignItems: "center", backgroundColor: "#eee", padding: 6, margin: 4, borderRadius: 12 },
  remover: { marginLeft: 6, color: "red", fontWeight: "bold" },
  toggleContainer: { flexDirection: "row", justifyContent: "space-around", marginVertical: 10 },
  toggleBtn: { padding: 10, borderRadius: 8, backgroundColor: "#838383ff", minWidth: 100, alignItems: "center" },
  ativo: { backgroundColor: "#4caf50" },
  toggleText: { color: "#fff", fontWeight: "bold" },
});
