import { useState } from "react";

import {
  FaCheck,
  FaEnvelope,
  FaExclamationTriangle,
  FaReply,
} from "react-icons/fa";

import { inbox } from "../../services/api";

import useAsyncData from "../../hooks/useAsyncData";
import usePageMeta from "../../hooks/usePageMeta";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../components/admin/AdminFeedback";

import "./MessagesAdmin.scss";

const STATUS_LABELS = {
  nouveau: "Nouveau",
  lu: "Lu",
  repondu: "Répondu",
};

const formatDateTime = (value) => {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const MessagesAdmin = () => {
  usePageMeta({
    title: "Messages — Administration",
    description:
      "Boîte de réception des messages envoyés depuis le site CAVA.",
  });

  const { data, loading, error, reload } = useAsyncData(inbox.list);

  const [selectedId, setSelectedId] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const messages = [...(data ?? [])].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );

  // La sélection est dérivée, pas synchronisée par un effet : à défaut
  // de choix explicite (ou si le message choisi a disparu), on affiche
  // le plus récent.
  const selected =
    messages.find((item) => item.id === selectedId) ??
    messages[0] ??
    null;

  const handleSelect = (id) => {
    setSelectedId(id);
    setReplyBody("");
    setActionError(null);
  };

  const runAction = async (operation) => {
    setBusy(true);
    setActionError(null);

    try {
      await operation();

      await reload();

      return true;
    } catch (caught) {
      setActionError(
        caught?.message ?? "L'action n'a pas pu être effectuée."
      );

      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleMarkRead = () =>
    runAction(() => inbox.markRead(selected.id));

  const handleReply = async (event) => {
    event.preventDefault();

    if (!replyBody.trim()) {
      setActionError("Merci de saisir une réponse avant d'enregistrer.");

      return;
    }

    const ok = await runAction(() =>
      inbox.reply(selected.id, replyBody.trim())
    );

    if (ok) {
      setReplyBody("");
    }
  };

  return (
    <div className="admin-messages">
      <header className="admin-messages__header">
        <div>
          <h1>Boîte de réception</h1>

          <p>
            Messages envoyés depuis le formulaire de contact du site.
          </p>
        </div>
      </header>

      {/* Avertissement permanent : aucune réponse ne part réellement. */}
      <div
        className="admin-messages__warning"
        role="note"
      >
        <FaExclamationTriangle aria-hidden="true" />

        <p>
          <strong>
            Les réponses ne sont pas envoyées par e-mail.
          </strong>{" "}
          Elles sont uniquement enregistrées dans ce navigateur, pour
          préparer l&apos;écran final. Tant que le backend n&apos;existe
          pas, contactez la personne par téléphone ou depuis votre
          messagerie habituelle.
        </p>
      </div>

      <div
        className="admin-messages__layout"
        aria-busy={loading}
      >
        {loading && (
          <AdminLoading label="Chargement des messages…" />
        )}

        {!loading && error && (
          <AdminError
            message={error}
            onRetry={reload}
          />
        )}

        {!loading && !error && messages.length === 0 && (
          <AdminEmpty message="Aucun message reçu. Les envois du formulaire de contact apparaîtront ici." />
        )}

        {!loading && !error && messages.length > 0 && (
          <>
            <nav
              className="admin-messages__list"
              aria-label="Liste des messages reçus"
            >
              <ul>
                {messages.map((message) => (
                  <li key={message.id}>
                    <button
                      type="button"
                      className={`admin-messages__item${
                        message.id === selected?.id
                          ? " admin-messages__item--active"
                          : ""
                      }`}
                      onClick={() => handleSelect(message.id)}
                      aria-current={
                        message.id === selected?.id ? "true" : undefined
                      }
                    >
                      <span className="admin-messages__item-top">
                        <strong>
                          {message.name || "Visiteur anonyme"}
                        </strong>

                        <span
                          className={`admin-messages__status admin-messages__status--${
                            message.status ?? "nouveau"
                          }`}
                        >
                          {STATUS_LABELS[message.status] ?? "Nouveau"}
                        </span>
                      </span>

                      <span className="admin-messages__item-subject">
                        {message.subject || "(sans sujet)"}
                      </span>

                      <span className="admin-messages__item-date">
                        {formatDateTime(message.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <article className="admin-messages__detail">
              {selected ? (
                <>
                  <header className="admin-messages__detail-head">
                    <h2>
                      {selected.subject || "(sans sujet)"}
                    </h2>

                    <dl className="admin-messages__meta">
                      <div>
                        <dt>De</dt>

                        <dd>
                          {selected.name || "Visiteur anonyme"}
                        </dd>
                      </div>

                      <div>
                        <dt>E-mail</dt>

                        <dd>
                          {selected.email ? (
                            <a href={`mailto:${selected.email}`}>
                              {selected.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt>Reçu le</dt>

                        <dd>{formatDateTime(selected.createdAt)}</dd>
                      </div>
                    </dl>

                    {selected.status === "nouveau" && (
                      <button
                        type="button"
                        className="admin-messages__mark"
                        onClick={handleMarkRead}
                        disabled={busy}
                      >
                        <FaCheck aria-hidden="true" />
                        Marquer comme lu
                      </button>
                    )}
                  </header>

                  <div className="admin-messages__body">
                    <p>{selected.message || "(message vide)"}</p>
                  </div>

                  {selected.replies?.length > 0 && (
                    <section
                      className="admin-messages__replies"
                      aria-label="Réponses enregistrées"
                    >
                      <h3>
                        Réponses enregistrées localement
                        <span className="admin-messages__replies-note">
                          {" "}
                          — non envoyées
                        </span>
                      </h3>

                      <ul>
                        {selected.replies.map((reply) => (
                          <li key={reply.id}>
                            <p>{reply.body}</p>

                            <time dateTime={reply.at}>
                              {formatDateTime(reply.at)}
                            </time>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <form
                    className="admin-messages__reply"
                    onSubmit={handleReply}
                  >
                    <label htmlFor="admin-message-reply">
                      Votre réponse
                    </label>

                    <textarea
                      id="admin-message-reply"
                      rows={5}
                      value={replyBody}
                      onChange={(event) =>
                        setReplyBody(event.target.value)
                      }
                      aria-describedby="admin-message-reply-help"
                      placeholder="Rédigez votre réponse…"
                    />

                    <p
                      className="admin-messages__help"
                      id="admin-message-reply-help"
                    >
                      Cette réponse sera enregistrée dans ce navigateur
                      et affichée ci-dessus. Elle ne sera pas envoyée à{" "}
                      {selected.email || "l'expéditeur"}.
                    </p>

                    {actionError && (
                      <p
                        className="admin-messages__error"
                        role="alert"
                      >
                        {actionError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      aria-busy={busy}
                    >
                      <FaReply aria-hidden="true" />

                      {busy
                        ? "Enregistrement…"
                        : "Enregistrer la réponse"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="admin-messages__placeholder">
                  <FaEnvelope aria-hidden="true" />

                  <p>Sélectionnez un message pour le consulter.</p>
                </div>
              )}
            </article>
          </>
        )}
      </div>
    </div>
  );
};

export default MessagesAdmin;
