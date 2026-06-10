import { Routes, Route } from "react-router-dom";

import Home from "../pages/Home/Home";
import About from "../pages/About/About";
import Ministries from "../pages/Ministries/Ministries";
import Events from "../pages/Events/Events";
import Media from "../pages/Media/Media";
import Contact from "../pages/Contact/Contact";
import Donate from "../pages/Donate/Donate";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/a-propos" element={<About />} />
      <Route path="/ministeres" element={<Ministries />} />
      <Route path="/evenements" element={<Events />} />
      <Route path="/medias" element={<Media />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/faire-un-don" element={<Donate />} />
    </Routes>
  );
};

export default AppRoutes;