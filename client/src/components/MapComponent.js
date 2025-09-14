import { Platform } from "react-native";

let MapComponent;
if (Platform.OS === "web") {
  MapComponent = require("./MapComponent.web").default;
} else {
  MapComponent = require("./MapComponent.native").default;
}

export default MapComponent;
