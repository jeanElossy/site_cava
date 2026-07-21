import { Link } from "react-router-dom";

import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  Church,
  Image,
  ImagePlus,
  Mail,
  MailOpen,
  Megaphone,
  Users,
} from "lucide-react";

import { inbox, stats } from "../../services/api";

import { currentUser } from "../../services/auth";

import useAsyncData from "../../hooks/useAsyncData";
import PublishButton from "../../components/admin/PublishButton";
import usePageMeta from "../../hooks/usePageMeta";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../components/admin/AdminFeedback";

import "./Dashboard.scss";

const SHORTCUTS = [
  {
    to: "/admin/medias",
    label: "Publier un média",
    hint: "Message, louange ou témoignage",
    icon: ImagePlus,
  },
  {
    to: "/admin/evenements",
    label: "Créer un événement",
    hint: "Culte, formation, camp",
    icon: CalendarPlus,
  },
  {
    to: "/admin/communaute",
    label: "Publier une annonce",
    hint: "Visible sur la page Communauté",
    icon: Megaphone,
  },
  {
    to: "/admin/messages",
    label: "Relever les messages",
    hint: "Demandes reçues via le site",
    icon: MailOpen,
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

const Dashboard = () => {
  usePageMeta({
    title: "Tableau de bord",
    description:
      "Vue d'ensemble de l'espace d'administration du site CAVA.",
  });

  // Références stables de `services/api.js` : pas de `useCallback` requis.
  const statsQuery = useAsyncData(stats);
  const inboxQuery = useAsyncData(inbox.list);

  const user = currentUser();

  const counters = statsQuery.data;

  const messages = [...(inboxQuery.data ?? [])]
    .sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    )
    .slice(0, 5);

  const cards = [
    {
      key: "inboxUnread",
      label: "Messages non lus",
      value: counters?.inboxUnread,
      icon: Mail,
      to: "/admin/messages",
      tone: "alert",
    },
    {
      key: "medias",
      label: "Médias publiés",
      value: counters?.medias,
      icon: Image,
      to: "/admin/medias",
    },
    {
      key: "events",
      label: "Événements",
      value: counters?.events,
      icon: Calendar,
      to: "/admin/evenements",
    },
    {
      key: "ministries",
      label: "Ministères",
      value: counters?.ministries,
      icon: Church,
      to: "/admin/ministeres",
    },
    {
      key: "members",
      label: "Membres",
      value: counters?.members,
      icon: Users,
      to: "/admin/communaute",
    },
  ];

  const firstName = String(user?.name ?? "")
    .trim()
    .split(/\s+/)[0];

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <h1>
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>

          <p>
            Voici l&apos;état du contenu du site et les derniers
            messages reçus.
          </p>
        </div>
      </header>

      {/* Bannière pleine largeur : c'est l'action la plus engageante de
          l'espace (elle reconstruit le site public), elle ne doit pas
          se confondre avec un bouton d'en-tête. */}
      <PublishButton />

      <section
        aria-labelledby="admin-dashboard-stats"
        className="admin-dashboard__section"
      >
        <h2
          id="admin-dashboard-stats"
          className="admin-dashboard__section-title"
        >
          Chiffres clés
        </h2>

        <div aria-busy={statsQuery.loading}>
          {statsQuery.loading && (
            <AdminLoading label="Chargement des statistiques…" />
          )}

          {!statsQuery.loading && statsQuery.error && (
            <AdminError
              message={statsQuery.error}
              onRetry={statsQuery.reload}
            />
          )}

          {!statsQuery.loading && !statsQuery.error && (
            <ul className="admin-dashboard__stats">
              {cards.map((card) => {
                const Icon = card.icon;

                const alerting =
                  card.tone === "alert" && card.value > 0;

                return (
                  <li key={card.key}>
                    <Link
                      to={card.to}
                      className={`admin-dashboard__stat${
                        alerting
                          ? " admin-dashboard__stat--alert"
                          : ""
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
                  {messages.map((message) => (
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

                            <span
                              className={`admin-dashboard__badge admin-dashboard__badge--${
                                message.status ?? "nouveau"
                              }`}
                            >
                              {message.status ?? "nouveau"}
                            </span>
                          </span>

                          <span className="admin-dashboard__message-subject">
                            {message.subject || "(sans sujet)"}
                          </span>

                          <span className="admin-dashboard__message-date">
                            {formatDate(message.createdAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </section>

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

          <ul className="admin-dashboard__shortcuts">
            {SHORTCUTS.map((shortcut) => {
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
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
