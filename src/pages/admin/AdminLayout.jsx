import { useEffect, useRef, useState } from "react";

import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import {
  Calendar,
  ChevronRight,
  Church,
  ExternalLink,
  HandCoins,
  Heart,
  Image,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquareQuote,
  Moon,
  RefreshCw,
  ScanLine,
  Send,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";

import { currentUser, signOut } from "../../services/auth";
import { STAFF_ROLES } from "../../routes/roleGroups";

import usePendingSubmissionsCount from "../../hooks/usePendingSubmissionsCount";

import ApiStatus from "../../components/admin/ApiStatus";

import logo from "../../assets/logo/logo_cava.gif";

import "./AdminLayout.scss";

// Navigation groupée. Sept liens à plat forment un mur indifférencié ;
// regroupés, ils se parcourent d'un coup d'œil.
// `roles` (facultatif) restreint l'entrée à certains rôles — voir
// RequireRole.jsx pour la garde de route correspondante, sur laquelle
// ce filtrage s'aligne. Sans `roles`, l'entrée reste visible à tout
// compte authentifié (c'est le cas de "Nouvelles âmes" : le seul
// module que voient les comptes soa/cana/coordinateur_bergeries/
// pasteur une fois connectés).
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
      { to: "/admin/messages", label: "Messages", icon: Mail, roles: STAFF_ROLES },
      { to: "/admin/dons", label: "Dons", icon: HandCoins, roles: STAFF_ROLES },
      {
        to: "/admin/newsletter",
        label: "Lettre d'information",
        icon: Send,
        roles: STAFF_ROLES,
      },
    ],
  },
  {
    title: "Contenu du site",
    roles: STAFF_ROLES,
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
      {
        to: "/admin/communaute",
        label: "Membres et annonces",
        icon: Users,
        badgeKey: "pendingSubmissions",
        roles: STAFF_ROLES,
      },
      {
        to: "/admin/temoignages",
        label: "Témoignages",
        icon: MessageSquareQuote,
        roles: STAFF_ROLES,
      },
      {
        to: "/admin/presences",
        label: "Badgeage des présences",
        icon: ScanLine,
        roles: STAFF_ROLES,
      },
      {
        to: "/admin/nouvelles-ames",
        label: "Nouvelles âmes",
        icon: Heart,
      },
    ],
  },
  {
    title: "Configuration",
    roles: STAFF_ROLES,
    items: [
      {
        to: "/admin/parametres",
        label: "Paramètres",
        icon: Settings,
      },
      {
        // Réservé à l'admin, même parmi les rôles "staff" — voir
        // agent.service.js. D'où un `roles` propre à cette entrée,
        // plus strict que celui du groupe.
        to: "/admin/agents",
        label: "Agents",
        icon: ShieldCheck,
        roles: ["admin"],
      },
    ],
  },
];

// Initiales pour la pastille d'identité. Deux lettres au maximum :
// au-delà, la pastille se déforme.
// Repliée/dépliée, la préférence traverse les sessions : sans elle,
// l'administrateur qui replie la barre pour gagner de la place la
// retrouverait dépliée à chaque connexion.
const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

// Même logique de persistance pour le thème : une préférence
// explicite (posée via le bouton de bascule) traverse les sessions et
// l'emporte toujours sur `prefers-color-scheme`. Tant qu'aucun choix
// n'a été fait, c'est la préférence système qui décide.
const THEME_KEY = "admin-theme";

const getInitialTheme = () => {
  const stored = window.localStorage.getItem(THEME_KEY);

  if (stored === "dark" || stored === "light") return stored;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

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

  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  );

  const [theme, setTheme] = useState(getInitialTheme);

  const [refreshing, setRefreshing] = useState(false);
  // Change à chaque clic sur « Actualiser » : posé en `key` sur
  // `<Outlet>`, il force React à démonter puis remonter l'écran actuel
  // — chaque page relance alors son propre chargement de données (son
  // propre petit indicateur, ex. `AdminLoading`), sans recharger tout
  // le navigateur ni perdre la mise en page de l'administration.
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useNavigate();

  const closeButtonRef = useRef(null);

  const user = currentUser();

  // Filtrage par rôle : un groupe/item sans `roles` reste visible à
  // tous, sinon il faut y figurer explicitement (voir NAV_GROUPS et
  // RequireRole.jsx, qui protège les routes correspondantes).
  const visibleNavGroups = NAV_GROUPS.filter(
    (group) => !group.roles || group.roles.includes(user?.role)
  )
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || item.roles.includes(user?.role)
      ),
    }))
    .filter((group) => group.items.length > 0);

  const pendingSubmissionsCount = usePendingSubmissionsCount();

  const badgeValues = { pendingSubmissions: pendingSubmissionsCount };

  // Le tiroir se referme dès qu'on suit un lien : sinon, sur mobile, il
  // masque l'écran qu'on vient d'ouvrir. Géré dans le gestionnaire de
  // clic plutôt que dans un effet sur l'URL — un effet qui appelle
  // `setState` provoque un rendu supplémentaire à chaque navigation,
  // pour un résultat que l'événement produit directement.
  const closeMenu = () => setMenuOpen(false);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;

      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");

      return next;
    });
  };

  const toggleTheme = () => {
    setTheme((previous) => {
      const next = previous === "dark" ? "light" : "dark";

      window.localStorage.setItem(THEME_KEY, next);

      return next;
    });
  };

  // Démonte/remonte l'écran actuel (voir `refreshKey`) au lieu d'un
  // rechargement complet du navigateur : chaque page relance son
  // propre chargement de données avec son propre indicateur, sans le
  // flash blanc ni perdre l'état de CETTE mise en page (barre latérale
  // repliée, thème…), qui vit ici et non dans l'écran remonté.
  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshKey((previous) => previous + 1);

    window.setTimeout(() => setRefreshing(false), 320);
  };

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
    <div className="admin-shell" data-theme={theme}>
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
        }${
          // La préférence "réduit" (persistée, voir SIDEBAR_COLLAPSED_KEY)
          // ne concerne que la barre ancrée au bureau : appliquée telle
          // quelle au tiroir mobile, elle masquait aussi les libellés
          // alors que le tiroir reste pleine largeur (voir la règle
          // `&--collapsed` sous `@media (max-width: 1024px)` dans
          // AdminLayout.scss) — un tiroir plein écran sans aucun texte.
          collapsed && !menuOpen ? " admin-shell__rail--collapsed" : ""
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
            className="admin-shell__collapse-toggle"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="admin-sidebar"
            aria-label={
              collapsed ? "Agrandir le menu" : "Réduire le menu"
            }
            title={collapsed ? "Agrandir le menu" : "Réduire le menu"}
          >
            {/* Une seule flèche, qui s'inverse selon le sens de
                l'action : vers la droite pour agrandir, vers la
                gauche (pivotée) pour réduire. */}
            <ChevronRight
              aria-hidden="true"
              className={
                collapsed
                  ? "admin-shell__collapse-icon"
                  : "admin-shell__collapse-icon admin-shell__collapse-icon--expanded"
              }
            />
          </button>

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
          {visibleNavGroups.map((group, index) => (
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

                  const badgeCount = item.badgeKey
                    ? badgeValues[item.badgeKey]
                    : 0;

                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={closeMenu}
                        // Repliée, la barre ne montre plus que
                        // l'icône : ce titre fournit l'équivalent du
                        // libellé au survol, plutôt que de le faire
                        // disparaître purement et simplement. Non
                        // pertinent dans le tiroir mobile, où le
                        // libellé reste toujours visible (voir la
                        // classe `--collapsed` juste au-dessus).
                        title={collapsed && !menuOpen ? item.label : undefined}
                        className={({ isActive }) =>
                          isActive
                            ? "admin-shell__link admin-shell__link--active"
                            : "admin-shell__link"
                        }
                      >
                        <Icon aria-hidden="true" />

                        <span>{item.label}</span>

                        {badgeCount > 0 && (
                          <span
                            className="admin-shell__link-badge"
                            aria-label={`${badgeCount} demande${
                              badgeCount > 1 ? "s" : ""
                            } en attente`}
                          >
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        )}
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
            className="admin-shell__theme-toggle"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Passer au thème clair"
                : "Passer au thème sombre"
            }
            title={
              theme === "dark"
                ? "Passer au thème clair"
                : "Passer au thème sombre"
            }
          >
            {theme === "dark" ? (
              <Sun aria-hidden="true" />
            ) : (
              <Moon aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className="admin-shell__refresh"
            onClick={handleRefresh}
            aria-label="Actualiser la page"
            title="Actualiser la page"
          >
            <RefreshCw
              aria-hidden="true"
              className={
                refreshing
                  ? "admin-shell__refresh-icon admin-shell__refresh-icon--spinning"
                  : "admin-shell__refresh-icon"
              }
            />
          </button>

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
          <Outlet key={refreshKey} />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
