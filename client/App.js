import Home from "./src/telas/home";
import { MarkersProvider } from "./src/context/MakersContext";

export default function App() {
  return (
    <MarkersProvider>
      <Home/>
    </MarkersProvider>  
  );
}