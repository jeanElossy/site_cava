import { useState } from "react";

import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import {
  FaBars,
  FaCalendarAlt,
  FaChurch,
  FaCog,
  FaEnvelope,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaPhotoVideo,
  FaSignOutAlt,
  FaTachometerAlt,
  FaTimes,
  FaUsers,
} from "react-icons/fa";

import { currentUser, signOut } from "../../services/auth";

import logo from "../../assets/logo/logo_cava.gif";

import "./AdminLayout.scss";

const NAV_ITEMS = [
  {
    to: "/admin",
    label: "Tableau de bord",
    icon: <FaTachometerAlt aria-hidden="true" />,
    end: true,
  },
  {
    to: "/admin/messages",
    label: "Messages",
    icon: <FaEnvelope aria-hidden="true" />,
  },
  {
    to: "/admin/medias",
    label: "Médias",
    icon: <FaPhotoVideo aria-hidden="true" />,
  },
  {
    to: "/admin/evenements",
    label: "Événements",
    icon: <FaCalendarAlt aria-hidden="true" />,
  },
  {
    to: "/admin/ministeres",
    label: "Ministères",
    icon: <FaChurch aria-hidden="true" />,
  },
  {
    to: "/admin/communaute",
    label: "Communauté",
    icon: <FaUsers aria-hidden="true" />,
  },
  {
    to: "/admin/parametres",
    label: "Paramètres",
    icon: <FaCog aria-hidden="true" />,
  },
];

const AdminLayout = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = useNavigate();

  const user = currentUser();

  // Le tiroir latéral se referme dès qu'on suit un lien, sinon il masque
  // sur mobile l'écran qu'on vient d'ouvrir.
  const closeMenu = () => setMenuOpen(false);

  const handleSignOut = () => {
    signOut();
    navigate("/admin/connexion", { replace: true });
  };

  return (
    <div className="admin-shell">
      {/* Avertissement permanent : cet espace n'a pas de backend. */}
      <div
        className="admin-shell__notice"
        role="note"
      >
        <FaExclamationTriangle aria-hidden="true" />

        <p>
          <strong>Mode démonstration.</strong> Cet espace n&apos;est
          relié à aucun serveur : les données sont enregistrées dans ce
          navigateur uniquement, ne sont partagées avec personne et
          disparaissent si le cache est vidé. La connexion n&apos;est pas
          une sécurité.
        </p>
      </div>

      <div className="admin-shell__frame">
        {menuOpen && (
          <div
            className="admin-shell__scrim"
            onClick={closeMenu}
            aria-hidden="true"
          ></div>
        )}

        <aside
          className={`admin-shell__sidebar${
            menuOpen ? " admin-shell__sidebar--open" : ""
          }`}
          id="admin-sidebar"
        >
          <div className="admin-shell__brand">
            <img
              src={logo}
              alt=""
              aria-hidden="true"
            />

            <span>Administration</span>
          </div>

          <nav
            className="admin-shell__nav"
            aria-label="Navigation de l'administration"
          >
            <ul>
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={closeMenu}
                    className={({ isActive }) =>
                      isActive
                        ? "admin-shell__link admin-shell__link--active"
                        : "admin-shell__link"
                    }
                  >
                    {item.icon}

                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="admin-shell__sidebar-footer">
            <Link
              to="/"
              onClick={closeMenu}
              className="admin-shell__link admin-shell__link--muted"
            >
              <FaExternalLinkAlt aria-hidden="true" />

              <span>Voir le site public</span>
            </Link>
          </div>
        </aside>

        <div className="admin-shell__main">
          <header className="admin-shell__header">
            <button
              type="button"
              className="admin-shell__burger"
              onClick={() => setMenuOpen((previous) => !previous)}
              aria-expanded={menuOpen}
              aria-controls="admin-sidebar"
              aria-label={
                menuOpen
                  ? "Fermer le menu d'administration"
                  : "Ouvrir le menu d'administration"
              }
            >
              {menuOpen ? (
                <FaTimes aria-hidden="true" />
              ) : (
                <FaBars aria-hidden="true" />
              )}
            </button>

            <div className="admin-shell__identity">
              <span className="admin-shell__identity-name">
                {user?.name ?? "Administrateur"}
              </span>

              <span className="admin-shell__identity-mail">
                {user?.email ?? "session locale"}
              </span>
            </div>

            <button
              type="button"
              className="admin-shell__signout"
              onClick={handleSignOut}
            >
              <FaSignOutAlt aria-hidden="true" />

              <span>Déconnexion</span>
            </button>
          </header>

          <main className="admin-shell__content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
