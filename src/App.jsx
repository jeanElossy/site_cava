import { BrowserRouter } from "react-router-dom";

import AppRoutes from "./routes/AppRoutes";
import CustomCursor from "./components/CustomCursor/CustomCursor";

function App() {
  return (
    <BrowserRouter>
      {/* Monté ICI plutôt que dans chaque page : il n'y a pas de layout
          partagé dans ce projet, et le curseur doit couvrir aussi bien
          le site public que /admin, /presences et /monitorat. C'est le
          seul point commun à tous. */}
      <CustomCursor />

      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
