import { useEffect, useRef, useState } from "react";

import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import {
  Calendar,
  Church,
  ExternalLink,
  HandCoins,
  Image,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Send,
  Settings,
  Users,
  X,
} from "lucide-react";

import { currentUser, signOut } from "../../services/auth";

import ApiStatus from "../../components/admin/ApiStatus";

import logo from "../../assets/logo/logo_cava.gif";

import "./AdminLayout.scss";

// Navigation groupée. Sept liens à plat forment un mur indifférencié ;
// regroupés, ils se parcourent d'un coup d'œil.
const NAV_GROUPS = [
  {
    title: null,
    items: [
      {
        to: "/admin",
        label: "Tableau de bord",
        icon: LayoutDashboard,
        end: true,
      },
      { to: "/admin/messages", label: "Messages", icon: Mail },
      { to: "/admin/dons", label: "Dons", icon: HandCoins },
      {
        to: "/admin/newsletter",
        label: "Lettre d'information",
        icon: Send,
      },
    ],
  },
  {
    title: "Contenu du site",
    items: [
      { to: "/admin/medias", label: "Médias", icon: Image },
      {
        to: "/admin/evenements",
        label: "Événements",
        icon: Calendar,
      },
      {
        to: "/admin/ministeres",
        label: "Ministères",
        icon: Church,
      },
    ],
  },
  {
    title: "Communauté",
    items: [
      { to: "/admin/communaute", label: "Membres et annonces", icon: Users },
    ],
  },
  {
    title: "Configuration",
    items: [
      {
        to: "/admin/parametres",
        label: "Paramètres",
        icon: Settings,
      },
    ],
  },
];

// Initiales pour la pastille d'identité. Deux lettres au maximum :
// au-delà, la pastille se déforme.
const initials = (name) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

const AdminLayout = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = useNavigate();

  const closeButtonRef = useRef(null);

  const user = currentUser();

  // Le tiroir se referme dès qu'on suit un lien : sinon, sur mobile, il
  // masque l'écran qu'on vient d'ouvrir. Géré dans le gestionnaire de
  // clic plutôt que dans un effet sur l'URL — un effet qui appelle
  // `setState` provoque un rendu supplémentaire à chaque navigation,
  // pour un résultat que l'événement produit directement.
  const closeMenu = () => setMenuOpen(false);

  // Échap referme le tiroir, et le défilement de la page est gelé tant
  // qu'il est ouvert — sans quoi le fond défile sous les doigts.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);

      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const handleSignOut = () => {
    signOut();

    navigate("/admin/connexion", { replace: true });
  };

  return (
    <div className="admin-shell">
      {menuOpen && (
        <button
          type="button"
          className="admin-shell__scrim"
          onClick={closeMenu}
          aria-label="Fermer le menu"
          tabIndex={-1}
        />
      )}

      <aside
        className={`admin-shell__rail${
          menuOpen ? " admin-shell__rail--open" : ""
        }`}
        id="admin-sidebar"
      >
        <div className="admin-shell__brand">
          <img
            src={logo}
            alt=""
            aria-hidden="true"
          />

          <div>
            <strong>CAVA</strong>

            <span>Administration</span>
          </div>

          <button
            type="button"
            className="admin-shell__rail-close"
            onClick={closeMenu}
            ref={closeButtonRef}
            aria-label="Fermer le menu"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <nav
          className="admin-shell__nav"
          aria-label="Navigation de l'administration"
        >
          {NAV_GROUPS.map((group, index) => (
            <div
              key={group.title ?? `group-${index}`}
              className="admin-shell__group"
            >
              {group.title && (
                <p className="admin-shell__group-title">
                  {group.title}
                </p>
              )}

              <ul>
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
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
                        <Icon aria-hidden="true" />

                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="admin-shell__rail-foot">
          <Link
            to="/"
            onClick={closeMenu}
            className="admin-shell__link admin-shell__link--muted"
          >
            <ExternalLink aria-hidden="true" />

            <span>Voir le site public</span>
          </Link>

          <ApiStatus />
        </div>
      </aside>

      <div className="admin-shell__main">
        <header className="admin-shell__header">
          <button
            type="button"
            className="admin-shell__burger"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-controls="admin-sidebar"
            aria-label="Ouvrir le menu d'administration"
          >
            <Menu aria-hidden="true" />
          </button>

          <div className="admin-shell__spacer" />

          <div className="admin-shell__identity">
            <span
              className="admin-shell__avatar"
              aria-hidden="true"
            >
              {initials(user?.name)}
            </span>

            <span className="admin-shell__identity-text">
              <strong>{user?.name ?? "Administrateur"}</strong>

              <span>{user?.email ?? ""}</span>
            </span>
          </div>

          <button
            type="button"
            className="admin-shell__signout"
            onClick={handleSignOut}
          >
            <LogOut aria-hidden="true" />

            <span>Déconnexion</span>
          </button>
        </header>

        <main className="admin-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
