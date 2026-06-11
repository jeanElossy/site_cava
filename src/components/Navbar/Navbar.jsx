import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Menu,
  X,
  Heart,
  Home,
  Info,
  Church,
  Calendar,
  PlayCircle,
  Phone
} from "lucide-react";

import {
  FaFacebookF,
  FaInstagram,
  FaYoutube
} from "react-icons/fa";

import logo from "../../assets/logo/logo_cava.gif";

import "./Navbar.scss";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  return (
    <header className="navbar">

      {open && (
        <div
          className="navbar__overlay"
          onClick={closeMenu}
        />
      )}

      <div className="navbar__container">

        <NavLink
          to="/"
          className="navbar__logo"
          onClick={closeMenu}
        >
          <img src={logo} alt="CAVA" />
        </NavLink>

        {/* Desktop */}
        <nav className="navbar__desktop">

          <NavLink to="/">
            Accueil
          </NavLink>

          <NavLink to="/about">
            À propos
          </NavLink>

          <NavLink to="/ministries">
            Ministères
          </NavLink>

          <NavLink to="/events">
            Événements
          </NavLink>

          <NavLink to="/media">
            Médias
          </NavLink>

          <NavLink to="/contact">
            Contact
          </NavLink>

        </nav>

        <NavLink
          to="/donate"
          className="navbar__don"
        >
          Faire un don
          <Heart size={18} />
        </NavLink>

        {/* Bouton Mobile */}

        <button
          className="navbar__toggle"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X size={30} /> : <Menu size={30} />}
        </button>

        {/* Menu Mobile */}

        <nav className={`navbar__mobile ${open ? "active" : ""}`}>

          <div className="navbar__mobile-header">
            <img src={logo} alt="CAVA" />
          </div>

          <div className="navbar__mobile-line" />

          <div className="navbar__mobile-links">

            <NavLink to="/" onClick={closeMenu}>
              <Home size={20} />
              <span>Accueil</span>
            </NavLink>

            <NavLink to="/about" onClick={closeMenu}>
              <Info size={20} />
              <span>À propos</span>
            </NavLink>

            <NavLink to="/ministries" onClick={closeMenu}>
              <Church size={20} />
              <span>Ministères</span>
            </NavLink>

            <NavLink to="/events" onClick={closeMenu}>
              <Calendar size={20} />
              <span>Événements</span>
            </NavLink>

            <NavLink to="/media" onClick={closeMenu}>
              <PlayCircle size={20} />
              <span>Médias</span>
            </NavLink>

            <NavLink to="/contact" onClick={closeMenu}>
              <Phone size={20} />
              <span>Contact</span>
            </NavLink>

          </div>

          <NavLink
            to="/donate"
            className="navbar__mobile-don"
            onClick={closeMenu}
          >
            <Heart size={18} />
            Faire un don
          </NavLink>

          <div className="navbar__socials">
            <FaFacebookF />
            <FaInstagram />
            <FaYoutube />
          </div>

        </nav>

      </div>

    </header>
  );
};

export default Navbar;