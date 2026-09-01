import { useCallback, useState } from "react";

import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Plus,
} from "lucide-react";

import ChildrenPage, {
  ChildrenStat,
} from "../../../components/children/ChildrenPage";

import AdminModal from "../../../components/admin/AdminModal";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import ChildrenAvatar from "../../../components/children/ChildrenAvatar";

import useAsyncData from "../../../hooks/useAsyncData";

import {
  createSession,
  listClasses,
  listSessions,
  sessionRollCall,
} from "../../../services/children";

import { formatLongDate, relativeDay } from "../../../utils/childrenDates";

import "./Children.scss";

// Libellés des statuts d'appel. Le backend stocke `excuse` sans accent
// (valeur d'énumération) ; l'accent appartient à l'affichage.
const STATUS = {
  present: { label: "Présent", tone: "ok" },
  absent: { label: "Absent", tone: "danger" },
  excuse: { label: "Excusé", tone: "warn" },
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const SessionsAdmin = () => {
  const [filters, setFilters] = useState({ classId: "", from: "", to: "" });

  const loadClasses = useCallback(() => listClasses(), []);

  const { data: classes } = useAsyncData(loadClasses);

  const load = useCallback(
    () =>
      listSessions({
        classId: filters.classId,
        from: filters.from,
        to: filters.to,
        limit: 50,
      }),
    [filters.classId, filters.from, filters.to]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  const items = data?.items ?? [];

  const [opening, setOpening] = useState(false);
  const [newSession, setNewSession] = useState({
    classId: "",
    date: todayKey(),
    title: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Appel consulté. Chargé À LA DEMANDE : la liste porte déjà les
  // compteurs, ramener chaque feuille d'appel avec elle multiplierait
  // le poids de la page par le nombre de séances affichées.
  const [viewing, setViewing] = useState(null);
  const [rollCall, setRollCall] = useState(null);
  const [rollCallError, setRollCallError] = useState(null);

  const openRollCall = async (session) => {
    setViewing(session);
    setRollCall(null);
    setRollCallError(null);

    try {
      setRollCall(await sessionRollCall(session.id));
    } catch (caught) {
      setRollCallError(caught);
    }
  };

  const set = (field) => (event) =>
    setFilters((current) => ({ ...current, [field]: event.target.value }));

  const setNew = (field) => (event) =>
    setNewSession((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      await createSession({
        classId: newSession.classId,
        date: newSession.date,
        ...(newSession.title ? { title: newSession.title } : {}),
      });

      setOpening(false);
      setNewSession({ classId: "", date: todayKey(), title: "" });

      reload();
    } catch (caught) {
      setFormError(caught);
    } finally {
      setSaving(false);
    }
  };

  const done = items.filter((item) => item.attendance.done);

  // Moyenne calculée sur les seules séances RÉELLEMENT appelées. Y
  // inclure celles qui ne le sont pas ferait chuter le taux à chaque
  // séance planifiée d'avance, ce qui n'apprendrait rien.
  const averageRate =
    done.length > 0
      ? Math.round(
          done.reduce((sum, item) => sum + (item.attendance.rate ?? 0), 0) /
            done.length
        )
      : null;

  return (
    <ChildrenPage
      title="Séances et appel"
      breadcrumb={[
        { label: "Administration", to: "/admin" },
        { label: "Enfants", to: "/admin/enfants" },
        { label: "Séances" },
      ]}
      action={
        <button
          type="button"
          className="children-button children-button--primary"
          onClick={() => setOpening(true)}
        >
          <Plus aria-hidden="true" />
          Planifier une séance
        </button>
      }
      stats={
        <>
          <ChildrenStat
            icon={CalendarDays}
            label="Séances listées"
            value={items.length}
          />

          <ChildrenStat
            icon={CheckCircle2}
            label="Appels faits"
            value={done.length}
            hint={
              items.length - done.length > 0
                ? `${items.length - done.length} en attente`
                : undefined
            }
            tone="ok"
          />

          <ChildrenStat
            icon={ClipboardList}
            label="Présence moyenne"
            value={averageRate === null ? "—" : `${averageRate} %`}
            hint={
              averageRate === null
                ? "Aucun appel sur la période"
                : `sur ${done.length} séance${done.length > 1 ? "s" : ""}`
            }
          />
        </>
      }
      filters={
        <>
          <label className="children-field">
            <span>Classe</span>

            <select
              value={filters.classId}
              onChange={set("classId")}
            >
              <option value="">Toutes les classes</option>

              {(classes ?? []).map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="children-field">
            <span>Du</span>

            <input
              type="date"
              value={filters.from}
              onChange={set("from")}
            />
          </label>

          <label className="children-field">
            <span>Au</span>

            <input
              type="date"
              value={filters.to}
              onChange={set("to")}
            />
          </label>
        </>
      }
    >
      {loading && <AdminLoading />}

      {error && <AdminError message={error.message} />}

      {!loading && !error && items.length === 0 && (
        <AdminEmpty message="Aucune séance sur cette période." />
      )}

      {items.length > 0 && (
        <div className="children-table-wrap">
          <table className="children-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Classe</th>
                <th>Moniteur responsable</th>
                <th>Appel</th>
                <th>Présence</th>
                <th aria-label="Actions" />
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="children-classcell">
                      <span>
                        <strong>{formatLongDate(item.date)}</strong>

                        <small className="children-table__muted">
                          {relativeDay(item.date)}
                        </small>
                      </span>
                    </span>
                  </td>

                  <td>
                    {item.class?.name ?? (
                      <span className="children-table__muted">—</span>
                    )}
                  </td>

                  <td>
                    {item.responsibleMonitor ? (
                      `${item.responsibleMonitor.firstName} ${item.responsibleMonitor.lastName}`
                    ) : (
                      <span className="children-table__muted">—</span>
                    )}
                  </td>

                  <td>
                    {item.attendance.done ? (
                      <span className="children-badge">
                        {item.attendance.recorded} / {item.attendance.expected}
                      </span>
                    ) : (
                      <span className="children-table__muted">Pas encore fait</span>
                    )}
                  </td>

                  <td className="children-table__mono">
                    {item.attendance.rate === null
                      ? "—"
                      : `${item.attendance.rate} %`}
                  </td>

                  <td>
                    <div className="children-table__actions">
                      <button
                        type="button"
                        className="children-button children-button--ghost"
                        onClick={() => openRollCall(item)}
                      >
                        Voir l'appel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {opening && (
        <AdminModal
          title="Planifier une séance"
          onClose={() => setOpening(false)}
        >
          <form
            className="children-form"
            onSubmit={submit}
          >
            {formError && (
              <p className="children-form__error">{formError.message}</p>
            )}

            <label className="children-field">
              <span>Classe *</span>

              <select
                value={newSession.classId}
                onChange={setNew("classId")}
                required
              >
                <option value="">Choisir une classe</option>

                {(classes ?? []).map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="children-field">
              <span>Date *</span>

              <input
                type="date"
                value={newSession.date}
                onChange={setNew("date")}
                required
              />
            </label>

            <label className="children-field">
              <span>Intitulé</span>

              <input
                value={newSession.title}
                onChange={setNew("title")}
                maxLength={160}
                placeholder="Culte des enfants"
              />
            </label>

            <p className="children-note">
              Une séance déjà planifiée pour cette classe et ce jour n'est
              pas dupliquée : elle est simplement retrouvée.
            </p>

            <div className="children-form__actions">
              <button
                type="button"
                className="children-button"
                onClick={() => setOpening(false)}
              >
                Annuler
              </button>

              <button
                type="submit"
                className="children-button children-button--primary"
                disabled={saving}
              >
                {saving ? "Enregistrement…" : "Planifier"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {viewing && (
        <AdminModal
          title={`Appel — ${viewing.class?.name ?? "classe"}`}
          description={formatLongDate(viewing.date)}
          onClose={() => setViewing(null)}
        >
          {rollCallError && <AdminError message={rollCallError.message} />}

          {!rollCall && !rollCallError && <AdminLoading />}

          {rollCall && rollCall.children.length === 0 && (
            <AdminEmpty message="Aucun enfant actif dans cette classe." />
          )}

          {rollCall && rollCall.children.length > 0 && (
            <div className="children-table-wrap">
              <table className="children-table">
                <thead>
                  <tr>
                    <th>Enfant</th>
                    <th>Statut</th>
                    <th>Remarque</th>
                  </tr>
                </thead>

                <tbody>
                  {rollCall.children.map((child) => (
                    <tr key={child.id}>
                      <td>
                        <span className="children-classcell">
                          <ChildrenAvatar
                            photo={child.photo}
                            firstName={child.firstName}
                            lastName={child.lastName}
                          />

                          <span>
                            <strong>
                              {child.firstName} {child.lastName}
                            </strong>

                            <small className="children-table__muted">
                              {child.fileNumber}
                            </small>
                          </span>
                        </span>
                      </td>

                      <td>
                        {child.status ? (
                          <span className="children-badge">
                            {STATUS[child.status]?.label ?? child.status}
                          </span>
                        ) : (
                          // Un enfant sans ligne d'appel n'est pas absent :
                          // personne ne s'est prononcé sur lui. Les
                          // confondre fausserait le taux de présence.
                          <span className="children-table__muted">
                            Non pointé
                          </span>
                        )}
                      </td>

                      <td>
                        {child.note || (
                          <span className="children-table__muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminModal>
      )}
    </ChildrenPage>
  );
};

export default SessionsAdmin;
