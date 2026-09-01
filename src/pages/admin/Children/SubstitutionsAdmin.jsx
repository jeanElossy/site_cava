import { useCallback, useEffect, useState } from "react";

import { ArrowLeftRight, CalendarClock, Plus, X } from "lucide-react";

import ChildrenPage, {
  ChildrenPanel,
  ChildrenStat,
} from "../../../components/children/ChildrenPage";

import AdminModal from "../../../components/admin/AdminModal";
import ChildrenAvatar from "../../../components/children/ChildrenAvatar";

import useAsyncData from "../../../hooks/useAsyncData";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import {
  cancelSubstitution,
  createSubstitution,
  listClasses,
  listMonitors,
  listSubstitutions,
} from "../../../services/children";

import {
  formatLongDate,
  formatShortDate,
  relativeDay,
} from "../../../utils/childrenDates";

import "./Children.scss";

const TABS = [
  { key: "", label: "Tous" },
  { key: "actif", label: "Actifs" },
  { key: "a_venir", label: "À venir" },
  { key: "termine", label: "Terminés" },
  { key: "annule", label: "Annulés" },
];

const STATE_LABELS = {
  actif: { label: "Actif", tone: "success" },
  a_venir: { label: "À venir", tone: "info" },
  termine: { label: "Terminé", tone: "muted" },
  annule: { label: "Annulé", tone: "danger" },
};

const EMPTY = {
  monitorId: "",
  replacedMonitorId: "",
  classId: "",
  mode: "period",
  startDate: "",
  endDate: "",
  reason: "",
};

/**
 * Remplacements temporaires.
 *
 * Les états « actif / à venir / terminé » ne sont PAS stockés : ils se
 * calculent à partir de la date du jour (voir substitution.service.js).
 * C'est ce qui garantit qu'un accès s'éteint à la seconde près, sans
 * qu'aucune tâche de fond ait à passer.
 */
const SubstitutionsAdmin = () => {
  const [classes, setClasses] = useState([]);
  const [monitors, setMonitors] = useState([]);

  const [tab, setTab] = useState("");

  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Le filtre d'état fait partie du chargement : changer d'onglet
  // relance la requête, plutôt que de refiltrer une liste déjà
  // téléchargée — l'état « actif » se calcule côté serveur, à partir de
  // la date du jour.
  const load = useCallback(
    () => listSubstitutions({ state: tab || undefined }),
    [tab]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  const items = data ?? [];

  useEffect(() => {
    listClasses({ status: "published" }).then(setClasses).catch(() => {});
    listMonitors({ status: "active" }).then(setMonitors).catch(() => {});
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      await createSubstitution({
        ...values,
        replacedMonitorId: values.replacedMonitorId || undefined,
      });

      setCreating(false);
      setValues(EMPTY);

      reload();
    } catch (caught) {
      setFormError(caught);
    } finally {
      setSaving(false);
    }
  };

  const onCancel = async (item) => {
    const reason = window.prompt(
      "Motif de l'annulation (facultatif) :",
      ""
    );

    // `prompt` renvoie null si l'utilisateur ferme la fenêtre : c'est
    // un renoncement, pas une annulation sans motif.
    if (reason === null) return;

    try {
      await cancelSubstitution(item.id, reason || undefined);

      reload();
    } catch (caught) {
      window.alert(caught.message);
    }
  };

  const set = (field) => (event) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const activeCount = items.filter((item) => item.state === "actif").length;
  const upcomingCount = items.filter((item) => item.state === "a_venir").length;

  return (
    <ChildrenPage
      title="Remplacements"
      breadcrumb={[
        { label: "Administration", to: "/admin" },
        { label: "Enfants", to: "/admin/enfants" },
        { label: "Remplacements" },
      ]}
      action={
        <button
          type="button"
          className="children-button children-button--primary"
          onClick={() => {
            setValues(EMPTY);
            setFormError(null);
            setCreating(true);
          }}
        >
          <Plus aria-hidden="true" />
          Créer un remplacement
        </button>
      }
      stats={
        <>
          <ChildrenStat
            icon={ArrowLeftRight}
            value={activeCount}
            label="Remplacements actifs"
            tone="success"
          />

          <ChildrenStat
            icon={CalendarClock}
            value={upcomingCount}
            label="À venir"
            tone="warning"
          />
        </>
      }
      filters={
        <div
          className="children-tabs"
          role="tablist"
        >
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={
                tab === item.key
                  ? "children-tabs__tab children-tabs__tab--active"
                  : "children-tabs__tab"
              }
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
      aside={
        <ChildrenPanel title="Ce qu'un remplacement fait — et ne fait pas">
          <p className="children-note">
            Le remplaçant reçoit l&apos;accès à la seconde classe{" "}
            <strong>uniquement pendant la période</strong>. Sa classe
            principale n&apos;est pas modifiée, et l&apos;accès se ferme tout
            seul à l&apos;échéance.
          </p>

          <p className="children-note">
            Chaque présence enregistrée pendant un remplacement conserve le nom
            du remplaçant <em>et</em> celui du moniteur remplacé.
          </p>
        </ChildrenPanel>
      }
    >
      {loading && <AdminLoading />}

      {error && (
        <AdminError
          message={error}
          onRetry={reload}
        />
      )}

      {!loading && !error && items.length === 0 && (
        <AdminEmpty message="Aucun remplacement à afficher." />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="children-table-wrap">
          <table className="children-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Classe</th>
                <th>Remplaçant</th>
                <th>Moniteur absent</th>
                <th>Motif</th>
                <th>État</th>
                <th aria-label="Actions" />
              </tr>
            </thead>

            <tbody>
              {items.map((item) => {
                const state = STATE_LABELS[item.state] ?? STATE_LABELS.termine;
                const relative = relativeDay(item.from);

                return (
                  <tr key={item.id}>
                    {/* Date — la colonne qu'on lit en premier, d'où le
                        repère relatif sous la date absolue. */}
                    <td>
                      <div className="children-daycell">
                        <span className="children-daycell__date">
                          {formatLongDate(item.from)}
                        </span>

                        {relative ? (
                          <span className="children-daycell__relative">
                            {relative}
                          </span>
                        ) : item.mode === "period" ? (
                          <span className="children-daycell__range">
                            jusqu&apos;au {formatShortDate(item.to)}
                          </span>
                        ) : (
                          <span className="children-daycell__range">
                            {item.sessionDates?.length ?? 0} séance
                            {(item.sessionDates?.length ?? 0) > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="children-classcell">
                        <span
                          className="children-classcell__icon"
                          aria-hidden="true"
                        >
                          {item.class?.icon || "👶"}
                        </span>

                        <span>
                          <strong>{item.class?.name}</strong>

                          {item.class?.room && <em>{item.class.room}</em>}
                        </span>
                      </span>
                    </td>

                    <td>
                      <span className="children-person">
                        <ChildrenAvatar
                          firstName={item.monitor?.firstName}
                          lastName={item.monitor?.lastName}
                          photo={item.monitor?.photo}
                          size="sm"
                        />

                        <span>
                          <strong>
                            {item.monitor?.firstName} {item.monitor?.lastName}
                          </strong>

                          <em>Remplaçant</em>
                        </span>
                      </span>
                    </td>

                    <td>
                      {item.replacedMonitor ? (
                        <span className="children-person">
                          <ChildrenAvatar
                            firstName={item.replacedMonitor.firstName}
                            lastName={item.replacedMonitor.lastName}
                            photo={item.replacedMonitor.photo}
                            size="sm"
                          />

                          <span>
                            <strong>
                              {item.replacedMonitor.firstName}{" "}
                              {item.replacedMonitor.lastName}
                            </strong>

                            <em>Absent</em>
                          </span>
                        </span>
                      ) : (
                        <span className="children-table__muted">
                          Poste vacant
                        </span>
                      )}
                    </td>

                    <td>
                      {item.reason || (
                        <span className="children-table__muted">—</span>
                      )}
                    </td>

                    <td>
                      <span
                        className={`children-badge children-badge--${state.tone}`}
                      >
                        {state.label}
                      </span>
                    </td>

                    <td>
                      <div className="children-table__actions">
                        {item.status === "valide" && (
                          <button
                            type="button"
                            className="children-button children-button--ghost"
                            onClick={() => onCancel(item)}
                            aria-label="Annuler ce remplacement"
                            title="Annuler ce remplacement"
                          >
                            <X aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <AdminModal
          title="Nouveau remplacement"
          onClose={() => setCreating(false)}
        >
          <form
            className="children-form"
            onSubmit={submit}
          >
            {formError && (
              <p className="children-form__error">{formError.message}</p>
            )}

            <label className="children-field">
              <span>Moniteur remplaçant *</span>

              <select
                value={values.monitorId}
                onChange={set("monitorId")}
                required
              >
                <option value="">Choisir…</option>

                {monitors.map((assignment) => (
                  <option
                    key={assignment.id}
                    value={assignment.member?.id}
                  >
                    {assignment.member?.firstName} {assignment.member?.lastName}
                  </option>
                ))}
              </select>
            </label>

            <label className="children-field">
              <span>Classe à couvrir *</span>

              <select
                value={values.classId}
                onChange={set("classId")}
                required
              >
                <option value="">Choisir…</option>

                {classes.map((item) => (
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
              <span>Moniteur remplacé</span>

              <select
                value={values.replacedMonitorId}
                onChange={set("replacedMonitorId")}
              >
                <option value="">Poste vacant / non précisé</option>

                {monitors.map((assignment) => (
                  <option
                    key={assignment.id}
                    value={assignment.member?.id}
                  >
                    {assignment.member?.firstName} {assignment.member?.lastName}
                  </option>
                ))}
              </select>
            </label>

            <div className="children-form__row">
              <label className="children-field">
                <span>Du *</span>

                <input
                  type="date"
                  value={values.startDate}
                  onChange={set("startDate")}
                  required
                />
              </label>

              <label className="children-field">
                <span>Au *</span>

                <input
                  type="date"
                  value={values.endDate}
                  onChange={set("endDate")}
                  required
                />
              </label>
            </div>

            <p className="children-form__hint">
              Pour un remplacement d&apos;un seul dimanche, indiquez la même
              date des deux côtés. L&apos;accès s&apos;ouvre le premier jour et
              se ferme automatiquement après le dernier.
            </p>

            <label className="children-field">
              <span>Motif</span>

              <input
                value={values.reason}
                onChange={set("reason")}
                maxLength={300}
                placeholder="Absence du moniteur"
              />
            </label>

            <div className="children-form__actions">
              <button
                type="button"
                className="children-button"
                onClick={() => setCreating(false)}
              >
                Annuler
              </button>

              <button
                type="submit"
                className="children-button children-button--primary"
                disabled={saving}
              >
                {saving ? "Enregistrement…" : "Créer le remplacement"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </ChildrenPage>
  );
};

export default SubstitutionsAdmin;
