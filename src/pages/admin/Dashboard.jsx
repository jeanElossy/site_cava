import { Link } from "react-router-dom";

import {
  FaCalendarAlt,
  FaChurch,
  FaEnvelope,
  FaEnvelopeOpenText,
  FaPhotoVideo,
  FaUsers,
} from "react-icons/fa";

import { inbox, stats } from "../../services/api";

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
    icon: <FaPhotoVideo aria-hidden="true" />,
  },
  {
    to: "/admin/evenements",
    label: "Créer un événement",
    icon: <FaCalendarAlt aria-hidden="true" />,
  },
  {
    to: "/admin/communaute",
    label: "Publier une annonce",
    icon: <FaUsers aria-hidden="true" />,
  },
  {
    to: "/admin/messages",
    label: "Relever les messages",
    icon: <FaEnvelopeOpenText aria-hidden="true" />,
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

const Dashboard = () => {
  usePageMeta({
    title: "Tableau de bord",
    description:
      "Vue d'ensemble de l'espace d'administration du site CAVA.",
  });

  // Références stables de `services/api.js` : pas de `useCallback` requis.
  const statsQuery = useAsyncData(stats);
  const inboxQuery = useAsyncData(inbox.list);

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
      icon: <FaEnvelope aria-hidden="true" />,
      to: "/admin/messages",
      highlight: true,
    },
    {
      key: "medias",
      label: "Médias publiés",
      value: counters?.medias,
      icon: <FaPhotoVideo aria-hidden="true" />,
      to: "/admin/medias",
    },
    {
      key: "events",
      label: "Événements",
      value: counters?.events,
      icon: <FaCalendarAlt aria-hidden="true" />,
      to: "/admin/evenements",
    },
    {
      key: "ministries",
      label: "Ministères",
      value: counters?.ministries,
      icon: <FaChurch aria-hidden="true" />,
      to: "/admin/ministeres",
    },
    {
      key: "members",
      label: "Membres enregistrés",
      value: counters?.members,
      icon: <FaUsers aria-hidden="true" />,
      to: "/admin/communaute",
    },
  ];

  return (
    <div className="admin-dashboard">

      <PublishButton />
      <header className="admin-dashboard__header">
        <h1>Tableau de bord</h1>

        <p>
          Vue d&apos;ensemble du contenu du site et des derniers messages
          reçus.
        </p>
      </header>

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
              {cards.map((card) => (
                <li key={card.key}>
                  <Link
                    to={card.to}
                    className={`admin-dashboard__stat${
                      card.highlight && card.value > 0
                        ? " admin-dashboard__stat--alert"
                        : ""
                    }`}
                  >
                    <span className="admin-dashboard__stat-icon">
                      {card.icon}
                    </span>

                    <span className="admin-dashboard__stat-value">
                      {card.value ?? 0}
                    </span>

                    <span className="admin-dashboard__stat-label">
                      {card.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="admin-dashboard__columns">
        <section
          aria-labelledby="admin-dashboard-inbox"
          className="admin-dashboard__section"
        >
          <div className="admin-dashboard__section-head">
            <h2
              id="admin-dashboard-inbox"
              className="admin-dashboard__section-title"
            >
              Derniers messages reçus
            </h2>

            <Link to="/admin/messages">Tout voir</Link>
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
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </section>

        <section
          aria-labelledby="admin-dashboard-shortcuts"
          className="admin-dashboard__section"
        >
          <h2
            id="admin-dashboard-shortcuts"
            className="admin-dashboard__section-title"
          >
            Raccourcis
          </h2>

          <ul className="admin-dashboard__shortcuts">
            {SHORTCUTS.map((shortcut) => (
              <li key={shortcut.to}>
                <Link to={shortcut.to}>
                  {shortcut.icon}

                  <span>{shortcut.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
