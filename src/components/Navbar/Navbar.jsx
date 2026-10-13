import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Briefcase,
  Calendar,
  ChevronDown,
  Church,
  Clock,
  Heart,
  Home,
  Info,
  Menu,
  Phone,
  PlayCircle,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  FaFacebookF,
  FaInstagram,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa";

import { dayLabel, site } from "../../content/settings";
import { safeHttpUrl } from "../../utils/safeUrl";

import logo from "../../assets/logo/logo_cava.gif";

import "./Navbar.scss";

// Liens du menu mobile. Le menu de bureau garde son balisage propre
// (sous-menu au survol) ; ces listes ne servent qu'au panneau mobile.
const MOBILE_LINKS = [
  { to: "/", label: "Accueil", icon: Home, end: true },
  { to: "/about", label: "À propos", icon: Info },
  { to: "/ministries", label: "Ministères", icon: Church },
  { to: "/events", label: "Événements", icon: Calendar },
  { to: "/media", label: "Médias", icon: PlayCircle },
];

const COMMUNITY_LINKS = [
  { to: "/communaute", label: "Notre communauté", icon: Users, end: true },
  { to: "/inscription", label: "Devenir membre", icon: UserPlus },
  { to: "/appel-a-candidature", label: "Appel à candidatures", icon: Briefcase },
];

// Réseaux : seulement des adresses http(s) valides (voir utils/safeUrl).
const SOCIALS = [
  { key: "facebook", label: "Facebook", icon: FaFacebookF },
  { key: "instagram", label: "Instagram", icon: FaInstagram },
  { key: "youtube", label: "YouTube", icon: FaYoutube },
  { key: "whatsapp", label: "WhatsApp", icon: FaWhatsapp },
]
  .map((item) => ({ ...item, href: safeHttpUrl(site.social?.[item.key]) }))
  .filter((item) => item.href);

const isCommunityPath = (pathname) =>
  COMMUNITY_LINKS.some(
    (link) => pathname === link.to || pathname.startsWith(`${link.to}/`)
  );

const Navbar = () => {
  const [open, setOpen] = useState(false);

  const { pathname } = useLocation();

  // Sous-liste « Communauté » : dépliée d'office quand on se trouve sur
  // l'une de ses pages, pour que le lien actif soit visible.
  const [communityOpen, setCommunityOpen] = useState(() =>
    isCommunityPath(pathname)
  );

  const toggleRef = useRef(null);
  const closeRef = useRef(null);

  const closeMenu = () => setOpen(false);

  // Menu ouvert : défilement de la page gelé (sinon la page défile sous
  // le panneau), Échap referme, et le focus entre dans le panneau. À la
  // fermeture, il revient sur le bouton qui l'a ouvert.
  useEffect(() => {
    if (!open) return undefined;

    const toggle = toggleRef.current;
    const root = document.documentElement;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = root.style.overflow;

    // `html` autant que `body` : iOS Safari ignore le blocage posé sur
    // `body` seul, et la page défilait encore sous le panneau.
    document.body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      root.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", onKeyDown);
      toggle?.focus();
    };
  }, [open]);

  return (
    <header className="navbar">

      {open && (
        <div
          className="navbar__overlay"
          onClick={closeMenu}
          aria-hidden="true"
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

          {/* Communauté ouvre un sous-menu au survol. Le lien reste
              cliquable et mène toujours à /communaute : le survol
              AJOUTE une entrée, il ne remplace pas la navigation.

              `:focus-within` autant que `:hover` (voir Navbar.scss) —
              sans quoi le sous-menu serait inatteignable au clavier, et
              sur un écran tactile, où il n'y a pas de survol. */}
          <div className="navbar__dropdown">
            <NavLink to="/communaute">
              Communauté
            </NavLink>

            <div className="navbar__submenu">
              {/* Le lien vers la page Communauté elle-même figure AUSSI
                  dans le panneau : sur un écran tactile, où le survol
                  n'existe pas, toucher « Communauté » ouvre le menu au
                  lieu de naviguer — sans cette entrée, la page devenait
                  inatteignable au doigt. */}
              <NavLink to="/communaute" end>
                Notre communauté
              </NavLink>

              <NavLink to="/inscription">
                Devenir membre
              </NavLink>

              <NavLink to="/appel-a-candidature">
                Appel à candidatures
              </NavLink>
            </div>
          </div>

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

        {/* Bouton d'ouverture du menu mobile. La fermeture se fait
            depuis le panneau lui-même (croix), par Échap ou par un
            toucher sur le voile. */}
        <button
          ref={toggleRef}
          type="button"
          className="navbar__toggle"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          aria-controls="navbar-mobile"
        >
          <Menu aria-hidden="true" />
        </button>

        {/* Panneau mobile. `inert` quand il est fermé : hors écran, ses
            liens restaient atteignables à la tabulation. */}
        <div
          id="navbar-mobile"
          className={`navbar__mobile${open ? " navbar__mobile--open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
          inert={!open}
        >
          <div className="navbar__mobile-head">
            <NavLink
              to="/"
              className="navbar__mobile-logo"
              onClick={closeMenu}
            >
              <img src={logo} alt="CAVA — accueil" />
            </NavLink>

            <button
              ref={closeRef}
              type="button"
              className="navbar__mobile-close"
              onClick={closeMenu}
              aria-label="Fermer le menu"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <nav
            className="navbar__mobile-body"
            aria-label="Navigation principale"
          >
            <ul className="navbar__mobile-links">
              {MOBILE_LINKS.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={closeMenu}
                  >
                    <span className="navbar__mobile-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span>{label}</span>
                  </NavLink>
                </li>
              ))}

              <li>
                <button
                  type="button"
                  className={`navbar__mobile-group${
                    isCommunityPath(pathname) ? " navbar__mobile-group--current" : ""
                  }`}
                  onClick={() => setCommunityOpen((value) => !value)}
                  aria-expanded={communityOpen}
                  aria-controls="navbar-mobile-community"
                >
                  <span className="navbar__mobile-icon">
                    <Users aria-hidden="true" />
                  </span>
                  <span>Communauté</span>
                  <ChevronDown
                    className="navbar__mobile-chevron"
                    aria-hidden="true"
                  />
                </button>

                <ul
                  id="navbar-mobile-community"
                  className="navbar__mobile-sublinks"
                  hidden={!communityOpen}
                >
                  {COMMUNITY_LINKS.map(({ to, label, icon: Icon, end }) => (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={end}
                        onClick={closeMenu}
                      >
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>

              <li>
                <NavLink
                  to="/contact"
                  onClick={closeMenu}
                >
                  <span className="navbar__mobile-icon">
                    <Phone aria-hidden="true" />
                  </span>
                  <span>Contact</span>
                </NavLink>
              </li>
            </ul>
          </nav>

          <div className="navbar__mobile-foot">
            {site.serviceTimes.length > 0 && (
              <p className="navbar__mobile-times">
                <Clock aria-hidden="true" />
                <span>
                  {site.serviceTimes
                    .map((service) => `${dayLabel(service.day)} ${service.time}`)
                    .join(" · ")}
                </span>
              </p>
            )}

            <NavLink
              to="/donate"
              className="navbar__mobile-don"
              onClick={closeMenu}
            >
              <Heart aria-hidden="true" />
              Faire un don
            </NavLink>

            {SOCIALS.length > 0 && (
              <ul className="navbar__socials">
                {SOCIALS.map(({ key, label, icon: Icon, href }) => (
                  <li key={key}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${label} (nouvel onglet)`}
                    >
                      <Icon aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>

    </header>
  );
};

export default Navbar;