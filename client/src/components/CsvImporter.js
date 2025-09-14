// CsvImporter.js
import React from "react";
import { Alert, TouchableOpacity, Text } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import Papa from "papaparse";
import { Buffer } from "buffer"; // npm install buffer se necessário

export default function CsvImporter({ onImport, style}) {
  const handleImportCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "text/csv" });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        let fileContent = "";

        if (uri.startsWith("data:text/csv;base64,")) {
          // Decodifica CSV base64
          const base64Data = uri.replace("data:text/csv;base64,", "");
          fileContent = Buffer.from(base64Data, "base64").toString("utf-8");
        } else {
          // Caso seja um arquivo físico
          const FileSystem = require("expo-file-system");
          fileContent = await FileSystem.readAsStringAsync(uri);
        }


        Papa.parse(fileContent, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const markers = results.data.map((row) => ({
              type: row.tipo?.trim().toLowerCase() || "mercado",
              coords: {
                lat: parseFloat(row.lat),
                lng: parseFloat(row.long),
              },
              frutas: row.produtos
                ? row.produtos.split(",").map((f) => f.trim())
                : [],
              quantidade: row.quantidade.trim().toLowerCase() || 10,
            }));
            onImport(markers);
          },
          error: (err) => Alert.alert("Erro ao processar CSV", err.message),
        });
      }
    } catch (err) {
      Alert.alert("Erro ao importar CSV", err.message);
    }
  };

  return <TouchableOpacity
          style={style}
          onPress={handleImportCSV}
          >
            <Text style={{fontWeight: "bold"}}>
              IMPORTAR CSV
            </Text>
        </TouchableOpacity>
}
