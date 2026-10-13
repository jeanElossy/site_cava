import { useEffect } from "react";

import { Link, Navigate, useOutletContext } from "react-router-dom";

import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Church,
  Heart,
  HeartHandshake,
  Image,
  ImagePlus,
  Mail,
  MailOpen,
  Megaphone,
  PiggyBank,
  UserPlus,
  Users,
} from "lucide-react";

import { inbox, newSouls, stats } from "../../services/api";
import { fetchSocialDashboard } from "../../services/social";

import { currentUser } from "../../services/auth";
import {
  AGENT_ROLES,
  FLOCK_ONLY_ROLES,
  SOCIAL_ONLY_ROLES,
  STAFF_ROLES,
} from "../../routes/roleGroups";
import { money } from "./Social/socialShared";
import { messageStatusLabel } from "./messageStatus";

import useAsyncData from "../../hooks/useAsyncData";
import PublishButton from "../../components/admin/PublishButton";
import usePageMeta from "../../hooks/usePageMeta";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../components/admin/AdminFeedback";

import "./Dashboard.scss";

// `roles` : même liste que la garde de la route visée (AdminRoutes.jsx).
// Un raccourci vers un écran refusé au rôle n'a rien à faire ici — un
// éditeur voyait « Nouvelles âmes » et tombait sur un refus.
const SHORTCUTS = [
  {
    to: "/admin/medias",
    label: "Publier un média",
    hint: "Message, louange ou témoignage",
    icon: ImagePlus,
    roles: STAFF_ROLES,
  },
  {
    to: "/admin/evenements",
    label: "Créer un événement",
    hint: "Culte, formation, camp",
    icon: CalendarPlus,
    roles: STAFF_ROLES,
  },
  {
    to: "/admin/communaute",
    label: "Publier une annonce",
    hint: "Visible sur la page Communauté",
    icon: Megaphone,
    roles: STAFF_ROLES,
  },
  {
    to: "/admin/messages",
    label: "Relever les messages",
    hint: "Demandes reçues via le site",
    icon: MailOpen,
    roles: STAFF_ROLES,
  },
  {
    to: "/admin/nouvelles-ames",
    label: "Nouvelles âmes",
    hint: "Tableau de bord SOA & CANA",
    icon: Heart,
    roles: [...AGENT_ROLES, "admin"],
  },
];

const formatDate = (value) => {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Date du jour en toutes lettres, avec une majuscule : « Mardi 13 octobre 2026 ».
const today = () => {
  const label = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
};

// Salutation selon l'heure : un détail, mais c'est ce qui distingue un
// outil qu'on ouvre tous les jours d'un panneau générique.
const greeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Bonjour";

  if (hour < 18) return "Bon après-midi";

  return "Bonsoir";
};

const initials = (name) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

const firstNameOf = (user) => String(user?.name ?? "").trim().split(/\s+/)[0];

// En-tête commun aux trois variantes du tableau de bord.
const DashboardHeader = ({ subtitle, children }) => {
  const firstName = firstNameOf(currentUser());

  return (
    <header className="admin-dashboard__header">
      <div>
        <p className="admin-dashboard__date">{today()}</p>

        <h1>
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>

        <p>{subtitle}</p>
      </div>

      {children}
    </header>
  );
};

// Cartes de chiffres, avec leurs états de chargement et d'erreur.
const KpiSection = ({ title, query, cards }) => (
  <section
    aria-label={title}
    className="admin-dashboard__section"
  >
    {title && <h2 className="admin-dashboard__section-title">{title}</h2>}

    <div aria-busy={query.loading}>
      {query.loading && <AdminLoading label="Chargement des statistiques…" />}

      {!query.loading && query.error && (
        <AdminError
          message={query.error}
          onRetry={query.reload}
        />
      )}

      {!query.loading && !query.error && (
        <ul className="admin-dashboard__stats">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <li key={card.key}>
                <Link
                  to={card.to}
                  className={`admin-dashboard__stat admin-dashboard__stat--${
                    card.tone ?? "accent"
                  }`}
                >
                  <span className="admin-dashboard__stat-icon">
                    <Icon aria-hidden="true" />
                  </span>

                  <span className="admin-dashboard__stat-value">
                    {card.value ?? 0}
                  </span>

                  <span className="admin-dashboard__stat-label">
                    {card.label}
                  </span>

                  <ArrowRight
                    className="admin-dashboard__stat-arrow"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  </section>
);

// Bloc « À traiter » : ce qui attend une action, avant les chiffres de
// contenu. Un compteur à zéro reste affiché, en sourdine (« À jour ») :
// le voir disparaître ferait douter qu'il ait été vérifié.
const TodoSection = ({ items }) => {
  const total = items.reduce((sum, item) => sum + (item.count ?? 0), 0);

  return (
    <section
      aria-labelledby="admin-dashboard-todo"
      className="admin-dashboard__section admin-dashboard__todo"
    >
      <div className="admin-dashboard__section-head">
        <h2
          id="admin-dashboard-todo"
          className="admin-dashboard__section-title"
        >
          À traiter
        </h2>

        <span
          className={
            total > 0
              ? "admin-dashboard__todo-total"
              : "admin-dashboard__todo-total admin-dashboard__todo-total--clear"
          }
        >
          {total > 0 ? (
            `${total} élément${total > 1 ? "s" : ""} en attente`
          ) : (
            <>
              <CheckCircle2 aria-hidden="true" />
              Tout est à jour
            </>
          )}
        </span>
      </div>

      <ul className="admin-dashboard__todo-list">
        {items.map((item) => {
          const Icon = item.icon;
          const pending = (item.count ?? 0) > 0;

          return (
            <li key={item.key}>
              <Link
                to={item.to}
                className={
                  pending
                    ? `admin-dashboard__todo-item admin-dashboard__todo-item--${item.tone}`
                    : "admin-dashboard__todo-item admin-dashboard__todo-item--clear"
                }
              >
                <span className="admin-dashboard__todo-icon">
                  <Icon aria-hidden="true" />
                </span>

                <span className="admin-dashboard__todo-text">
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </span>

                <span className="admin-dashboard__todo-count">
                  {pending ? (item.count > 99 ? "99+" : item.count) : "À jour"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const ShortcutList = ({ shortcuts }) => (
  <ul className="admin-dashboard__shortcuts">
    {shortcuts.map((shortcut) => {
      const Icon = shortcut.icon;

      return (
        <li key={shortcut.to}>
          <Link to={shortcut.to}>
            <span className="admin-dashboard__shortcut-icon">
              <Icon aria-hidden="true" />
            </span>

            <span className="admin-dashboard__shortcut-text">
              <strong>{shortcut.label}</strong>

              <span>{shortcut.hint}</span>
            </span>

            <ArrowRight aria-hidden="true" />
          </Link>
        </li>
      );
    })}
  </ul>
);

// Tableau de bord allégé pour les comptes agents (soa, cana,
// coordinateur_bergeries, pasteur) : ils n'ont accès à aucune des
// sections de `StaffDashboard` — leur charger `stats`/`inbox.list`
// échouerait (403) en plus d'être hors sujet.
const AgentDashboard = () => {
  const statsQuery = useAsyncData(newSouls.stats);
  const counters = statsQuery.data;

  const cards = [
    { key: "total", label: "Dossiers suivis", value: counters?.total, icon: Heart, to: "/admin/nouvelles-ames" },
    { key: "soaPending", label: "En attente SOA", value: counters?.soaPending, icon: UserPlus, to: "/admin/nouvelles-ames", tone: "warning" },
    { key: "canaActive", label: "En accompagnement CANA", value: counters?.canaActive, icon: HeartHandshake, to: "/admin/nouvelles-ames", tone: "info" },
    { key: "closedThisMonth", label: "Clôturés ce mois-ci", value: counters?.closedThisMonth, icon: CheckCircle2, to: "/admin/nouvelles-ames", tone: "success" },
  ];

  return (
    <div className="admin-dashboard">
      <DashboardHeader subtitle="Voici l'état des dossiers Nouvelles Âmes." />

      <KpiSection
        title="Chiffres clés"
        query={statsQuery}
        cards={cards}
      />

      <section
        aria-label="Raccourcis"
        className="admin-dashboard__section admin-dashboard__panel"
      >
        <ShortcutList
          shortcuts={[
            {
              to: "/admin/nouvelles-ames",
              label: "Nouvelles âmes",
              hint: "Voir tous les dossiers et le tableau de bord SOA & CANA",
              icon: Heart,
            },
          ]}
        />
      </section>
    </div>
  );
};

// Tableau de bord allégé pour les comptes exclusivement Service Social
// — même principe qu'AgentDashboard ci-dessus.
const SocialOnlyDashboard = () => {
  const statsQuery = useAsyncData(fetchSocialDashboard);
  const data = statsQuery.data;

  const cards = [
    {
      key: "contributions",
      label: "Offrandes du mois",
      value: `${data?.contributionsThisMonth?.paidCount ?? 0} / ${data?.contributionsThisMonth?.totalMembers ?? 0}`,
      icon: HeartHandshake,
      to: "/admin/social/cotisations",
    },
    {
      key: "collected",
      label: "Collecté ce mois-ci",
      value: money(data?.amountCollectedThisMonth ?? 0),
      icon: CheckCircle2,
      to: "/admin/social/cotisations",
      tone: "success",
    },
    {
      key: "late",
      label: "Offrandes en retard",
      value: data?.lateContributions ?? 0,
      icon: AlertTriangle,
      to: "/admin/social/arrieres",
      tone: "warning",
    },
    {
      key: "cashBalance",
      label: "Caisse sociale",
      value: money(data?.cashBalance ?? 0),
      icon: PiggyBank,
      to: "/admin/social/caisse",
      tone: "info",
    },
  ];

  return (
    <div className="admin-dashboard">
      <DashboardHeader subtitle="Voici l'état du Service Social." />

      <KpiSection
        title="Chiffres clés"
        query={statsQuery}
        cards={cards}
      />

      <section
        aria-label="Raccourcis"
        className="admin-dashboard__section admin-dashboard__panel"
      >
        <ShortcutList
          shortcuts={[
            {
              to: "/admin/social",
              label: "Service Social",
              hint: "Voir le tableau de bord, les offrandes, les aides et la caisse",
              icon: Heart,
            },
          ]}
        />
      </section>
    </div>
  );
};

const StaffDashboard = () => {
  // Références stables de `services/api.js` : pas de `useCallback` requis.
  const statsQuery = useAsyncData(stats);
  const inboxQuery = useAsyncData(inbox.list);

  // Compteurs du menu, déjà chargés et rafraîchis par AdminLayout.
  const { badges } = useOutletContext() ?? {};

  // `reload` seul comme dépendance : il reste stable (voir
  // useAsyncData), contrairement aux objets de requête.
  const { reload: reloadStats } = statsQuery;
  const { reload: reloadInbox } = inboxQuery;

  // `useAsyncData` ne charge qu'une fois au montage : sans ce sondage,
  // un message reçu entre-temps n'apparaissait qu'après rechargement.
  // `reload()` ne repasse pas par l'état « chargement » : pas de
  // clignotement des chiffres déjà affichés.
  useEffect(() => {
    const interval = setInterval(() => {
      reloadStats();
      reloadInbox();
    }, 30000);

    return () => clearInterval(interval);
  }, [reloadStats, reloadInbox]);

  const role = currentUser()?.role;

  const counters = statsQuery.data;

  const messages = [...(inboxQuery.data ?? [])]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 5);

  const todo = [
    {
      key: "messages",
      label: "Messages non lus",
      hint: "Reçus depuis la page Contact du site",
      count: counters?.inboxUnread ?? 0,
      to: "/admin/messages",
      icon: Mail,
      tone: "danger",
    },
    {
      key: "submissions",
      label: "Inscriptions à valider",
      hint: "Demandes envoyées depuis « Devenir membre »",
      count: badges?.pendingSubmissions ?? 0,
      to: "/admin/communaute?onglet=submissions",
      icon: UserPlus,
      tone: "warning",
    },
    // Nouvelles âmes : réservé à l'administrateur parmi les rôles de ce
    // tableau de bord (un éditeur n'a pas accès au module).
    role === "admin" && {
      key: "newSouls",
      label: "Nouvelles âmes à suivre",
      hint: "Dossiers SOA à transmettre, suivis CANA",
      count: badges?.newSouls ?? 0,
      to: "/admin/nouvelles-ames",
      icon: Heart,
      tone: "info",
    },
  ].filter(Boolean);

  const cards = [
    { key: "medias", label: "Médias publiés", value: counters?.medias, icon: Image, to: "/admin/medias" },
    { key: "events", label: "Événements", value: counters?.events, icon: Calendar, to: "/admin/evenements", tone: "info" },
    { key: "ministries", label: "Ministères", value: counters?.ministries, icon: Church, to: "/admin/ministeres", tone: "warning" },
    { key: "members", label: "Membres", value: counters?.members, icon: Users, to: "/admin/communaute?onglet=members", tone: "success" },
  ];

  const shortcuts = SHORTCUTS.filter((shortcut) => shortcut.roles.includes(role));

  return (
    <div className="admin-dashboard">
      <DashboardHeader subtitle="Voici ce qui attend une action et l'état du contenu du site." />

      <TodoSection items={todo} />

      {/* Bannière pleine largeur : c'est l'action la plus engageante de
          l'espace (elle reconstruit le site public), elle ne doit pas
          se confondre avec un bouton d'en-tête. */}
      <PublishButton />

      <KpiSection
        title="Contenu du site"
        query={statsQuery}
        cards={cards}
      />

      <div className="admin-dashboard__columns">
        <section
          aria-labelledby="admin-dashboard-inbox"
          className="admin-dashboard__section admin-dashboard__panel"
        >
          <div className="admin-dashboard__section-head">
            <h2
              id="admin-dashboard-inbox"
              className="admin-dashboard__section-title"
            >
              Derniers messages
            </h2>

            <Link
              to="/admin/messages"
              className="admin-dashboard__see-all"
            >
              Tout voir
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>

          <div aria-busy={inboxQuery.loading}>
            {inboxQuery.loading && (
              <AdminLoading label="Chargement des messages…" />
            )}

            {!inboxQuery.loading && inboxQuery.error && (
              <AdminError
                message={inboxQuery.error}
                onRetry={inboxQuery.reload}
              />
            )}

            {!inboxQuery.loading &&
              !inboxQuery.error &&
              messages.length === 0 && (
                <AdminEmpty message="Aucun message reçu pour le moment. Les messages envoyés depuis la page Contact apparaîtront ici." />
              )}

            {!inboxQuery.loading &&
              !inboxQuery.error &&
              messages.length > 0 && (
                <ul className="admin-dashboard__messages">
                  {messages.map((message) => {
                    const status = message.status ?? "nouveau";

                    return (
                      <li key={message.id}>
                        <Link to="/admin/messages">
                          <span
                            className="admin-dashboard__message-avatar"
                            aria-hidden="true"
                          >
                            {initials(message.name)}
                          </span>

                          <span className="admin-dashboard__message-body">
                            <span className="admin-dashboard__message-top">
                              <strong>
                                {message.name || "Visiteur anonyme"}
                              </strong>

                              <span className="admin-dashboard__message-date">
                                {formatDate(message.createdAt)}
                              </span>
                            </span>

                            <span className="admin-dashboard__message-subject">
                              {message.subject || "(sans sujet)"}
                            </span>
                          </span>

                          <span
                            className={`admin-dashboard__badge admin-dashboard__badge--${status}`}
                          >
                            {messageStatusLabel(status)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>
        </section>

        {shortcuts.length > 0 && (
          <section
            aria-labelledby="admin-dashboard-shortcuts"
            className="admin-dashboard__section admin-dashboard__panel"
          >
            <div className="admin-dashboard__section-head">
              <h2
                id="admin-dashboard-shortcuts"
                className="admin-dashboard__section-title"
              >
                Actions rapides
              </h2>
            </div>

            <ShortcutList shortcuts={shortcuts} />
          </section>
        )}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const role = currentUser()?.role;
  const isAgent = AGENT_ROLES.includes(role);
  const isSocialOnly = !isAgent && SOCIAL_ONLY_ROLES.includes(role);
  const isFlockOnly = FLOCK_ONLY_ROLES.includes(role);

  usePageMeta(
    isAgent
      ? {
          title: "Nouvelles âmes — Tableau de bord",
          description: "Suivi des dossiers SOA et CANA.",
        }
      : isSocialOnly
        ? {
            title: "Service Social — Tableau de bord",
            description: "Offrandes, aides et caisse de solidarité.",
          }
        : {
            title: "Tableau de bord",
            description: "Vue d'ensemble de l'espace d'administration du site CAVA.",
          }
  );

  if (isAgent) return <AgentDashboard />;
  if (isSocialOnly) return <SocialOnlyDashboard />;

  // Un responsable de bergerie n'a pas de tableau de bord à lui : son
  // portail EN EST un. Le laisser atterrir sur le tableau de bord
  // général l'aurait mené sur des compteurs alimentés par des routes
  // que son rôle ne peut pas lire — une page d'erreurs, pas un accueil.
  if (isFlockOnly) return <Navigate to="/admin/bergerie" replace />;

  return <StaffDashboard />;
};

export default Dashboard;
