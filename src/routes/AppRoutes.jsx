import { Routes, Route } from "react-router-dom";

import Home from "../pages/Home/Home";
import About from "../pages/About/About";
import Ministries from "../pages/Ministries/Ministries";
import MinistryDetails from "../pages/MinistryDetails/MinistryDetails";
import Events from "../pages/Events/Events";
import Media from "../pages/Media/Media";
import Contact from "../pages/Contact/Contact";
import Donate from "../pages/Donate/Donate";
import NotFound from "../pages/NotFound/NotFound";

const AppRoutes = () => {
  return (
    <Routes>

      <Route
        path="/"
        element={<Home />}
      />

      <Route
        path="/about"
        element={<About />}
      />

      <Route
        path="/ministries"
        element={<Ministries />}
      />

      <Route
        path="/ministries/:slug"
        element={<MinistryDetails />}
      />
      

      <Route
        path="/events"
        element={<Events />}
      />

      <Route
        path="/media"
        element={<Media />}
      />

      <Route
        path="/contact"
        element={<Contact />}
      />

      <Route
        path="/donate"
        element={<Donate />}
      />

      <Route
        path="*"
        element={<NotFound />}
      />

    </Routes>
  );
};

export default AppRoutes;

