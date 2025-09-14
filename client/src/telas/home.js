// Home.js
import React, {useContext, useEffect, useState } from "react";
import { View, Text, StyleSheet, Button, TouchableOpacity } from "react-native";
import MapComponent from "../componentes/MapComponent";
import CsvImporter from "../componentes/CsvImporter";
import { StatusBar } from "expo-status-bar";
import { submit, submitTest } from "../componentes/connection";
import { MarkersContext } from "../context/MakersContext";

export default function Home() {
  const [csvMarkers, setCsvMarkers] = useState([]);
  const { markers, setMarkers } = useContext(MarkersContext);
  const [markerOtimo, setMarkerOtimo] = useState(null);


  const Enviar = async () => {
    try {
      const response = await submit(markers);
      const data = await response.json();
      setMarkerOtimo(data);
    } catch (error) {
      console.error("Erro ao enviar dados:", error);
    }
  };
// const Enviar = async () => {
//   try {
//     const response = await submitTest(markers);
//     const data = await response.json();
//     setMarkerOtimo(data); // agora sim, os dados estão prontos
//   } catch (error) {
//     console.error("Erro ao enviar dados:", error);
//   }
// };




  return (
    <View style={styles.main}>
      <Text style={styles.title}>CADASTRE SEU NEGÓCIO DE FRUTICULTURA</Text>
      <Text style={styles.infoText}>
        SELECIONE A REGIÃO CLICANDO NO MAPA
      </Text>
      <View style={styles.mapContainer}>
        <MapComponent style={styles.mapa} importedMarkers={csvMarkers} markerOtimo={markerOtimo}/>
      </View>
      <StatusBar style="dark" />
      <View style={styles.buttomContainer}>
        <CsvImporter style={styles.botaoImport} onImport={setCsvMarkers} />
        <TouchableOpacity
          style={styles.botaoSubmit}
          onPress={Enviar}
        >
          <Text style={{fontWeight: "bold"}}>
            CALCULAR LOGÍSTICA
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { 
    flex: 1, 
    padding: 10,
    backgroundColor: "#1f2322"
   },
  title: {
    fontSize: 30,
    color: "#fff",
    fontWeight: "bold"
  },
  infoText: { 
    marginBottom: 10, 
    fontSize: 16,
    color: "#63e67a"
  },
  buttomContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignContent: "center",
    gap: 50,
  },
  botaoImport: { 
    backgroundColor: "#009e1c",
    padding: 10,
    margin: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
  },
  botaoSubmit: {
    backgroundColor: "#ff6d4d",
    padding: 10,
    margin: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
  },
  mapContainer: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    fontWeight: "bold",
  },
  mapa: {
    flex: 1,
    alignSelf: "center"
  }
});
