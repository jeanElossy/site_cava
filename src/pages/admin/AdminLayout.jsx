import { useCallback, useEffect, useRef, useState } from "react";

import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Sun,
  X,
} from "lucide-react";

import {
  currentUser,
  revalidateSession,
  signOut,
} from "../../services/auth";
import { SESSION_EXPIRED_EVENT } from "../../services/http";

import usePendingSubmissionsCount from "../../hooks/usePendingSubmissionsCount";
import useNewSoulsBadgeCount from "../../hooks/useNewSoulsBadgeCount";
import usePushNotifications from "../../hooks/usePushNotifications";
import useIdleTimeout from "../../hooks/useIdleTimeout";

import AdminModal from "../../components/admin/AdminModal";
import ApiStatus from "../../components/admin/ApiStatus";
import QuickNav from "../../components/admin/QuickNav";

import {
  ROLE_LABELS,
  findActiveEntry,
  visibleNavGroups as navGroupsFor,
} from "./adminNav";

import logo from "../../assets/logo/logo_cava.gif";

import "./AdminLayout.scss";

// Clé du jeton dans le localStorage (voir services/http.js) : écoutée
// pour suivre une déconnexion faite dans un AUTRE onglet.
const TOKEN_STORAGE_KEY = "cava:token";

// Le Mac affiche ⌘, les autres Ctrl : c'est la touche que la
// personne doit réellement presser.
const SHORTCUT_LABEL =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform ?? "")
    ? "⌘K"
    : "Ctrl K";

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
  const [quickNavOpen, setQuickNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  );

  const [theme, setTheme] = useState(getInitialTheme);

  const [refreshing, setRefreshing] = useState(false);
  // Change à chaque clic sur « Actualiser » : posé en `key` sur
  // `<Outlet>`, il force React à démonter puis remonter l'écran actuel
  // — chaque page relance alors son propre chargement de données, sans
  // recharger tout le navigateur ni perdre la mise en page.
  const [refreshKey, setRefreshKey] = useState(0);

  // Le rôle peut changer après la revalidation de la session (compte
  // rétrogradé entre deux visites) : ce compteur force un nouveau rendu,
  // qui relit l'utilisateur mémorisé.
  const [, setSessionVersion] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();

  const closeButtonRef = useRef(null);
  const accountRef = useRef(null);

  // Relu à chaque rendu : la revalidation ci-dessous force un rendu
  // une fois le profil mis à jour.
  const user = currentUser();

  // Filtrage par rôle, partagé avec le fil d'Ariane et la recherche
  // rapide (voir adminNav.js). Confort seulement : l'API refuse.
  const visibleNavGroups = navGroupsFor(user?.role);

  const activeEntry = findActiveEntry(location.pathname, visibleNavGroups);

  const pendingSubmissionsCount = usePendingSubmissionsCount();
  const newSoulsBadgeCount = useNewSoulsBadgeCount();

  const badgeValues = {
    pendingSubmissions: pendingSubmissionsCount,
    newSouls: newSoulsBadgeCount,
  };

  const pushNotifications = usePushNotifications();

  const togglePushNotifications = () => {
    if (pushNotifications.subscribed) {
      pushNotifications.disable();
    } else {
      pushNotifications.enable();
    }
  };

  // ---- Fin de session ------------------------------------------------
  //
  // Trois façons de perdre la session, un seul chemin de sortie : la
  // connexion, avec la raison affichée et la page à rouvrir ensuite.
  //   expired   le serveur a refusé le jeton (expiré, révoqué, compte
  //             désactivé) ;
  //   idle      inactivité prolongée sur ce poste ;
  //   elsewhere déconnexion faite dans un autre onglet.
  const leave = useCallback(
    (reason) => {
      signOut();

      navigate("/admin/connexion", {
        replace: true,
        state: { reason, from: window.location.pathname },
      });
    },
    [navigate]
  );

  // Revalidation au chargement : sans elle, un jeton expiré depuis la
  // veille ouvrait un tableau de bord rempli d'erreurs.
  useEffect(() => {
    let cancelled = false;

    revalidateSession().then((status) => {
      if (cancelled) return;

      if (status === "expired") leave("expired");
      else if (status === "valid") setSessionVersion((value) => value + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [leave]);

  useEffect(() => {
    const onExpired = () => leave("expired");

    const onStorage = (event) => {
      if (event.key === TOKEN_STORAGE_KEY && !event.newValue) {
        leave("elsewhere");
      }
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener("storage", onStorage);
    };
  }, [leave]);

  const idle = useIdleTimeout(() => leave("idle"));

  // ---- Recherche rapide : Ctrl+K / ⌘K, et « / » hors d'un champ -------
  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickNavOpen((open) => !open);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setQuickNavOpen(true);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // ---- Menu du compte : se referme au clic extérieur et sur Échap -------
  useEffect(() => {
    if (!accountOpen) return undefined;

    const onPointerDown = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        accountRef.current?.querySelector("button")?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  // Le tiroir se referme dès qu'on suit un lien : sinon, sur mobile, il
  // masque l'écran qu'on vient d'ouvrir. Géré dans le gestionnaire de
  // clic plutôt que dans un effet sur l'URL — un effet qui appelle
  // `setState` provoque un rendu supplémentaire à chaque navigation.
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
  // rechargement complet du navigateur.
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

  const identifier = user?.email ?? user?.registrationNumber ?? "";

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

          {/* Fil d'Ariane : où l'on est, sans relire le menu. Une fiche
              (« /admin/enfants/64f… ») renvoie à sa liste parente. */}
          <nav
            className="admin-shell__crumbs"
            aria-label="Fil d'Ariane"
          >
            {activeEntry ? (
              <>
                {activeEntry.group.title && (
                  <>
                    <span className="admin-shell__crumb-group">
                      {activeEntry.group.title}
                    </span>

                    <ChevronRight
                      className="admin-shell__crumb-sep"
                      aria-hidden="true"
                    />
                  </>
                )}

                {activeEntry.exact ? (
                  <span
                    className="admin-shell__crumb-current"
                    aria-current="page"
                  >
                    {activeEntry.item.label}
                  </span>
                ) : (
                  <>
                    <Link
                      to={activeEntry.item.to}
                      className="admin-shell__crumb-link"
                    >
                      {activeEntry.item.label}
                    </Link>

                    <ChevronRight
                      className="admin-shell__crumb-sep"
                      aria-hidden="true"
                    />

                    <span
                      className="admin-shell__crumb-current"
                      aria-current="page"
                    >
                      Détail
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="admin-shell__crumb-current">
                Administration
              </span>
            )}
          </nav>

          <button
            type="button"
            className="admin-shell__search"
            onClick={() => setQuickNavOpen(true)}
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Search aria-hidden="true" />

            <span className="admin-shell__search-label">
              Rechercher une page…
            </span>

            <kbd>{SHORTCUT_LABEL}</kbd>
          </button>

          <div className="admin-shell__tools">
            {pushNotifications.supported && (
              <button
                type="button"
                className="admin-shell__tool"
                onClick={togglePushNotifications}
                disabled={pushNotifications.loading}
                aria-pressed={pushNotifications.subscribed}
                aria-label={
                  pushNotifications.subscribed
                    ? "Désactiver les notifications"
                    : "Activer les notifications"
                }
                title={
                  pushNotifications.error ||
                  (pushNotifications.subscribed
                    ? "Désactiver les notifications"
                    : "Activer les notifications")
                }
              >
                {pushNotifications.subscribed ? (
                  <Bell aria-hidden="true" />
                ) : (
                  <BellOff aria-hidden="true" />
                )}
              </button>
            )}

            <button
              type="button"
              className="admin-shell__tool"
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
              className="admin-shell__tool"
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
          </div>

          <div
            className="admin-shell__account"
            ref={accountRef}
          >
            <button
              type="button"
              className="admin-shell__account-toggle"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-controls="admin-account-panel"
            >
              <span
                className="admin-shell__avatar"
                aria-hidden="true"
              >
                {initials(user?.name)}
              </span>

              <span className="admin-shell__identity-text">
                <strong>{user?.name ?? "Administrateur"}</strong>

                <span>{ROLE_LABELS[user?.role] ?? user?.role ?? ""}</span>
              </span>

              <ChevronDown
                className="admin-shell__account-caret"
                aria-hidden="true"
              />

              <span className="sr-only">Menu du compte</span>
            </button>

            {accountOpen && (
              <div
                className="admin-shell__account-panel"
                id="admin-account-panel"
              >
                <div className="admin-shell__account-head">
                  <span
                    className="admin-shell__avatar admin-shell__avatar--large"
                    aria-hidden="true"
                  >
                    {initials(user?.name)}
                  </span>

                  <span>
                    <strong>{user?.name ?? "Administrateur"}</strong>

                    {identifier && <span>{identifier}</span>}

                    <span className="admin-shell__role-pill">
                      {ROLE_LABELS[user?.role] ?? user?.role ?? "—"}
                    </span>
                  </span>
                </div>

                <ul>
                  <li>
                    <Link
                      to="/"
                      onClick={() => setAccountOpen(false)}
                      className="admin-shell__account-item"
                    >
                      <ExternalLink aria-hidden="true" />
                      Voir le site public
                    </Link>
                  </li>

                  <li>
                    <button
                      type="button"
                      className="admin-shell__account-item admin-shell__account-item--danger"
                      onClick={handleSignOut}
                    >
                      <LogOut aria-hidden="true" />
                      Se déconnecter
                    </button>
                  </li>
                </ul>

                <p className="admin-shell__account-note">
                  Déconnexion automatique après 30 minutes sans activité.
                </p>
              </div>
            )}
          </div>
        </header>

        <main
          className="admin-shell__content"
          id="admin-content"
        >
          {/* Les compteurs du menu sont déjà chargés (et rafraîchis)
              ici : le tableau de bord les lit par le contexte plutôt
              que de redemander les mêmes chiffres à l'API. */}
          <Outlet
            key={refreshKey}
            context={{ badges: badgeValues }}
          />
        </main>
      </div>

      {quickNavOpen && (
        <QuickNav
          groups={visibleNavGroups}
          onClose={() => setQuickNavOpen(false)}
        />
      )}

      {idle.warning && (
        <AdminModal
          title="Êtes-vous toujours là ?"
          description="Par sécurité, la session se ferme après 30 minutes sans activité sur ce poste."
          onClose={idle.stayActive}
        >
          <div className="admin-shell__idle">
            <p>
              Déconnexion dans{" "}
              <strong>
                {idle.secondsLeft} seconde{idle.secondsLeft > 1 ? "s" : ""}
              </strong>
              . Les modifications non enregistrées seront perdues.
            </p>

            <div className="admin-shell__idle-actions">
              <button
                type="button"
                className="admin-shell__idle-leave"
                onClick={handleSignOut}
              >
                Se déconnecter
              </button>

              <button
                type="button"
                className="admin-shell__idle-stay"
                onClick={idle.stayActive}
              >
                Rester connecté
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default AdminLayout;
