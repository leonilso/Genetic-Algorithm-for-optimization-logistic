import React, {useContext, useState, useEffect } from "react";
import { View, Modal, StyleSheet, Dimensions } from "react-native";
import MapView, { Marker } from "react-native-maps";
import Formulario from "./Formulario";
import { MarkersContext } from "../context/MakersContext";

export default function MapComponent({ importedMarkers = [], markerOtimo}) {
  const { markers, setMarkers } = useContext(MarkersContext);
  const [showForm, setShowForm] = useState(false);
  const [newMarkerCoords, setNewMarkerCoords] = useState(null);
  const [frutas, setFrutas] = useState(null);
  const [quantidade, setQuantidade] = useState(null);
  const [markerType, setMarkerType] = useState("mercado");
  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState(null);

  console.log(markerOtimo)
  useEffect(() => {
    setMarkers(importedMarkers);
  }, [importedMarkers]);

  const { height, width } = Dimensions.get("window");

  const handleSave = (data) => {
    const quantidadeNumerica = parseInt(data.quantidade, 10);
    if (selectedMarkerIndex !== null) {
      // Atualiza marker existente
      const updatedMarkers = [...markers];
      updatedMarkers[selectedMarkerIndex] = { 
        type: data.tipo, 
        coords: data.coords, 
        frutas: data.frutas, 
        quantidade: quantidadeNumerica
      };
    } else {
      // Adiciona novo marker
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
    <View style={{ flex: 1 }}>
      {/* MapView ocupa 60% da tela */}
      <View style={{ height: height * 0.6, width: width * 0.9, alignSelf: "center" }}>
        <MapView
          style={{ flex: 1 }}
          provider="google"
          initialRegion={{
            latitude: -15.78,
            longitude: -47.92,
            latitudeDelta: 10,
            longitudeDelta: 10,
          }}
          onPress={(e) => {
            setNewMarkerCoords(e.nativeEvent.coordinate);
            setMarkerType("mercado");
            setSelectedMarkerIndex(null);
            setFrutas(null);
            setShowForm(true);
          }}
        >
          {markers.map((m, i) => (
            <Marker
              key={i}
              coordinate={m.coords}
              onPress={() => {
                setSelectedMarkerIndex(i);
                setNewMarkerCoords(m.coords);
                setFrutas(m.frutas)
                setMarkerType(m.type);
                setShowForm(true);
              }}
            />
          ))}
          {markerOtimo && 
                      <Marker
                        key={"markerOtimo"}
                        coordinate={markerOtimo.optimal_location_coord}
                        icon={industriaIcon}
                      >
                      <Popup>
                          lat:{markerOtimo.optimal_location_coord.lat} lng{markerOtimo.optimal_location_coord.lng} <br />
                          custo total{markerOtimo.total_cost}
                        </Popup>
                      </Marker>
                    }
        </MapView>
      </View>

      {/* Modal do formulário */}
      <Modal visible={showForm} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <Formulario
            markerType={markerType}
            coords={newMarkerCoords}
            frutas={frutas}
            onClose={() => {
              setShowForm(false);
              setSelectedMarkerIndex(null);
            }}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});
