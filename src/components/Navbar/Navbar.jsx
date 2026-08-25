import { useEffect, useState } from "react";
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
  Users,
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

  // Le bouton de fermeture appartient à l'en-tête (position: absolute),
  // pas au panneau du menu lui-même (position: fixed) : si la page
  // sous-jacente continue de défiler pendant que le menu est ouvert,
  // l'en-tête — et donc ce bouton — défile avec elle, pendant que le
  // panneau reste fixé à l'écran. Bloquer le défilement tant que le
  // menu est ouvert règle les deux à la fois (même mécanisme que
  // AdminModal, ailleurs dans ce projet).
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

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

          <NavLink to="/communaute">
            Communauté
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

            <NavLink to="/communaute" onClick={closeMenu}>
              <Users size={20} />
              <span>Communauté</span>
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