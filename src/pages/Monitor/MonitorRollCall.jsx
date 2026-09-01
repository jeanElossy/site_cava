import { useEffect, useMemo, useState } from "react";

import { ArrowLeft, Check, CheckCheck, Loader2, X } from "lucide-react";

import {
  monitorRollCall,
  openMonitorSession,
  submitRollCall,
} from "../../services/monitor";

const STATUSES = [
  { key: "present", label: "Présent", icon: Check },
  { key: "absent", label: "Absent", icon: X },
  { key: "excuse", label: "Excusé", icon: null },
];

/**
 * Faire l'appel — l'écran le plus utilisé du module, et le seul qui
 * soit vraiment critique côté ergonomie.
 *
 * Trois partis pris, tous dictés par la réalité du terrain :
 *
 *   1. « TOUS PRÉSENTS » d'abord. Un dimanche ordinaire, presque tout
 *      le monde est là : le moniteur corrige trois absents plutôt que
 *      de pointer vingt-quatre présences.
 *
 *   2. UN SEUL ENVOI, à la fin. Une requête par enfant ferait
 *      vingt-quatre allers-retours depuis un téléphone dans une salle
 *      de classe ; la première coupure laisserait l'appel à moitié
 *      enregistré, sans que personne sache lesquels sont passés.
 *
 *   3. DE GRANDES CIBLES. On tape avec le pouce, debout, parfois avec
 *      un enfant dans les bras (voir Monitor.scss : 56 px minimum).
 */
const MonitorRollCall = ({ target, onClose }) => {
  const classId = target.class.id ?? target.class._id;

  const [session, setSession] = useState(null);
  const [children, setChildren] = useState([]);
  const [statuses, setStatuses] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        // Ouvre la séance du jour, ou retrouve celle qui existe déjà :
        // deux moniteurs qui appuient en même temps tombent sur la
        // même (index unique `{classe, jour}` côté serveur).
        const opened = await openMonitorSession(classId, {});

        if (cancelled) return;

        const sessionId = opened.id ?? opened._id;

        const roll = await monitorRollCall(sessionId);

        if (cancelled) return;

        setSession(roll.session);
        setChildren(roll.children);

        // Reprend les statuts déjà saisis : rouvrir l'écran après une
        // interruption ne doit pas repartir d'une feuille blanche.
        setStatuses(
          Object.fromEntries(
            roll.children
              .filter((child) => child.status)
              .map((child) => [child.id, child.status])
          )
        );
      } catch (caught) {
        if (!cancelled) setError(caught.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    start();

    return () => {
      cancelled = true;
    };
  }, [classId]);

  const setStatus = (childId, status) => {
    setSaved(false);
    setStatuses((current) => ({ ...current, [childId]: status }));
  };

  const markAll = () => {
    setSaved(false);
    setStatuses(
      Object.fromEntries(children.map((child) => [child.id, "present"]))
    );
  };

  const counts = useMemo(() => {
    const values = Object.values(statuses);

    return {
      present: values.filter((value) => value === "present").length,
      absent: values.filter((value) => value === "absent").length,
      excuse: values.filter((value) => value === "excuse").length,
      pending: children.length - values.length,
    };
  }, [statuses, children.length]);

  const submit = async () => {
    setSaving(true);
    setError("");

    try {
      const entries = Object.entries(statuses).map(([childId, status]) => ({
        childId,
        status,
      }));

      await submitRollCall(session.id ?? session._id, entries);

      setSaved(true);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="monitor-roll">
      <header className="monitor-roll__head">
        <button
          type="button"
          className="monitor-roll__back"
          onClick={onClose}
          aria-label="Retour"
        >
          <ArrowLeft aria-hidden="true" />
        </button>

        <div>
          <h1>{target.class.name}</h1>

          <p>
            {target.kind === "remplacement" ? "Remplacement — " : ""}
            {children.length} enfant{children.length > 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {loading && <p className="monitor-roll__loading">Chargement de la liste…</p>}

      {error && (
        <p
          className="monitor-roll__error"
          role="alert"
        >
          {error}
        </p>
      )}

      {!loading && children.length === 0 && (
        <p className="monitor-roll__empty">
          Aucun enfant actif dans cette classe.
        </p>
      )}

      {!loading && children.length > 0 && (
        <>
          <button
            type="button"
            className="monitor-roll__all"
            onClick={markAll}
          >
            <CheckCheck aria-hidden="true" />
            Tous présents
          </button>

          <ul className="monitor-roll__list">
            {children.map((child) => (
              <li
                key={child.id}
                className="monitor-roll__row"
              >
                <span className="monitor-roll__child">
                  {child.firstName} {child.lastName}
                </span>

                <div
                  className="monitor-roll__choices"
                  role="group"
                  aria-label={`Présence de ${child.firstName}`}
                >
                  {STATUSES.map((status) => (
                    <button
                      key={status.key}
                      type="button"
                      aria-pressed={statuses[child.id] === status.key}
                      className={
                        statuses[child.id] === status.key
                          ? `monitor-roll__choice monitor-roll__choice--${status.key} monitor-roll__choice--on`
                          : "monitor-roll__choice"
                      }
                      onClick={() => setStatus(child.id, status.key)}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <footer className="monitor-roll__foot">
            <p className="monitor-roll__counts">
              <span className="monitor-roll__count monitor-roll__count--present">
                {counts.present} présents
              </span>

              <span className="monitor-roll__count monitor-roll__count--absent">
                {counts.absent} absents
              </span>

              <span className="monitor-roll__count monitor-roll__count--excuse">
                {counts.excuse} excusés
              </span>

              {counts.pending > 0 && (
                <span className="monitor-roll__count">
                  {counts.pending} non renseignés
                </span>
              )}
            </p>

            <button
              type="button"
              className="monitor-roll__submit"
              onClick={submit}
              disabled={saving || counts.pending === children.length}
            >
              {saving && (
                <Loader2
                  className="monitor-roll__spinner"
                  aria-hidden="true"
                />
              )}

              {saving
                ? "Enregistrement…"
                : saved
                  ? "Enregistré ✓ — renvoyer"
                  : "Enregistrer l'appel"}
            </button>

            {saved && (
              <p
                className="monitor-roll__saved"
                role="status"
              >
                Appel enregistré. Vous pouvez encore corriger et renvoyer.
              </p>
            )}
          </footer>
        </>
      )}
    </main>
  );
};

export default MonitorRollCall;
