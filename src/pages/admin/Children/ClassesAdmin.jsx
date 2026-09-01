import { useCallback, useState } from "react";

import { Archive, GraduationCap, Pencil, Plus, Users } from "lucide-react";

import ChildrenPage, {
  ChildrenPanel,
  ChildrenStat,
} from "../../../components/children/ChildrenPage";

import AdminModal from "../../../components/admin/AdminModal";

import { colorFor } from "../../../components/children/ChildrenChart/palette";

import useAsyncData from "../../../hooks/useAsyncData";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import {
  archiveClass,
  createClass,
  listClasses,
  updateClass,
} from "../../../services/children";

import "./Children.scss";

const EMPTY = {
  name: "",
  description: "",
  icon: "",
  ageMin: "",
  ageMax: "",
  room: "",
  usualDay: "dimanche",
  usualStartTime: "",
  usualEndTime: "",
  church: 1,
};

const DAYS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

/**
 * Classes de l'École du dimanche.
 *
 * Entièrement configurables : ni le nombre de classes, ni leurs noms,
 * ni leurs tranches d'âge ne sont codés en dur. L'assemblée en compte
 * trois (03-05, 06-08, 09-12) ; elle doit pouvoir en ouvrir une
 * quatrième sans développeur.
 */
const ClassesAdmin = () => {
  // `useAsyncData` plutôt qu'un `useEffect` qui appellerait `setState`
  // en synchrone : le hook du projet gère déjà chargement, erreur et
  // annulation si le composant est démonté avant la réponse.
  const load = useCallback(() => listClasses(), []);

  const { data, loading, error, reload } = useAsyncData(load);

  const items = data ?? [];

  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const openCreate = () => {
    setValues(EMPTY);
    setEditing("nouveau");
    setFormError(null);
  };

  const openEdit = (item) => {
    setValues({
      name: item.name ?? "",
      description: item.description ?? "",
      icon: item.icon ?? "",
      ageMin: item.ageMin ?? "",
      ageMax: item.ageMax ?? "",
      room: item.room ?? "",
      usualDay: item.usualDay ?? "dimanche",
      usualStartTime: item.usualStartTime ?? "",
      usualEndTime: item.usualEndTime ?? "",
      church: item.church ?? 1,
    });

    setEditing(item.id);
    setFormError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload = {
      ...values,
      // Les champs numériques du formulaire reviennent en chaîne : les
      // envoyer tels quels ferait échouer la validation Mongoose avec
      // un message peu parlant.
      ageMin: values.ageMin === "" ? undefined : Number(values.ageMin),
      ageMax: values.ageMax === "" ? undefined : Number(values.ageMax),
      church: Number(values.church),
    };

    try {
      if (editing === "nouveau") {
        await createClass(payload);
      } else {
        await updateClass(editing, payload);
      }

      setEditing(null);

      reload();
    } catch (caught) {
      setFormError(caught);
    } finally {
      setSaving(false);
    }
  };

  const onArchive = async (item) => {
    // Confirmation explicite : l'archivage retire la classe des listes
    // d'affectation, et le message d'erreur du serveur (« elle compte
    // encore N enfants ») arrive après coup.
    if (
      !window.confirm(
        `Archiver la classe « ${item.name} » ? Elle disparaîtra des listes, mais son historique de séances et de présences sera conservé.`
      )
    ) {
      return;
    }

    try {
      await archiveClass(item.id);

      reload();
    } catch (caught) {
      window.alert(caught.message);
    }
  };

  const active = items.filter((item) => item.status !== "archived");

  const childTotal = active.reduce((total, item) => total + item.childCount, 0);

  const monitorTotal = active.reduce(
    (total, item) => total + (item.monitors?.length ?? 0),
    0
  );

  const set = (field) => (event) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  return (
    <ChildrenPage
      title="Classes de l'École du dimanche"
      breadcrumb={[
        { label: "Administration", to: "/admin" },
        { label: "Enfants", to: "/admin/enfants" },
        { label: "Classes" },
      ]}
      action={
        <button
          type="button"
          className="children-button children-button--primary"
          onClick={openCreate}
        >
          <Plus aria-hidden="true" />
          Ajouter une classe
        </button>
      }
      stats={
        <>
          <ChildrenStat
            icon={GraduationCap}
            value={active.length}
            label="Classes actives"
          />

          <ChildrenStat
            icon={Users}
            value={childTotal}
            label="Enfants inscrits"
            tone="success"
          />

          <ChildrenStat
            icon={Users}
            value={monitorTotal}
            label="Moniteurs affectés"
            tone="warning"
          />
        </>
      }
      aside={
        <ChildrenPanel title="À savoir">
          <p className="children-note">
            Les tranches d&apos;âge sont <strong>indicatives</strong> : elles
            suggèrent une classe au moment d&apos;inscrire un enfant, mais
            n&apos;empêchent jamais une affectation. Un enfant en avance, en
            retard, ou qu&apos;on garde avec sa fratrie reste possible.
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
        <AdminEmpty message="Aucune classe pour le moment. Créez la première pour commencer à inscrire des enfants." />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="children-table-wrap">
          <table className="children-table">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Tranche d&apos;âge</th>
                <th>Salle</th>
                <th>Moniteurs</th>
                <th>Enfants</th>
                <th>Statut</th>
                <th aria-label="Actions" />
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <span className="children-classcell">
                      <span
                        className="children-classcell__icon"
                        aria-hidden="true"
                        style={{
                          // Même couleur que dans les graphiques : une
                          // classe se reconnaît à sa teinte d'un écran
                          // à l'autre. L'index vient de l'ordre par
                          // âge, jamais de la position à l'écran.
                          boxShadow: `inset 0 0 0 2px ${colorFor(index)}`,
                        }}
                      >
                        {item.icon || "👶"}
                      </span>

                      <span>
                        <strong>{item.name}</strong>

                        {item.usualStartTime && (
                          <em>
                            {item.usualDay} {item.usualStartTime}
                            {item.usualEndTime ? ` – ${item.usualEndTime}` : ""}
                          </em>
                        )}
                      </span>
                    </span>

                  </td>

                  <td>
                    {typeof item.ageMin === "number" ? (
                      <span className="children-badge">
                        {item.ageMin} – {item.ageMax} ans
                      </span>
                    ) : (
                      <span className="children-table__muted">—</span>
                    )}
                  </td>

                  <td>{item.room || <span className="children-table__muted">—</span>}</td>

                  <td>
                    {item.monitors?.length > 0 ? (
                      item.monitors
                        .map((assignment) =>
                          assignment.member
                            ? `${assignment.member.firstName} ${assignment.member.lastName}`
                            : null
                        )
                        .filter(Boolean)
                        .join(", ")
                    ) : (
                      <span className="children-table__muted">Aucun</span>
                    )}
                  </td>

                  <td className="children-table__mono">{item.childCount}</td>

                  <td>
                    <span
                      className={
                        item.status === "archived"
                          ? "children-badge children-badge--muted"
                          : "children-badge children-badge--success"
                      }
                    >
                      {item.status === "archived" ? "Archivée" : "Active"}
                    </span>
                  </td>

                  <td>
                    <div className="children-table__actions">
                      <button
                        type="button"
                        className="children-button children-button--ghost"
                        onClick={() => openEdit(item)}
                        aria-label={`Modifier ${item.name}`}
                      >
                        <Pencil aria-hidden="true" />
                      </button>

                      {item.status !== "archived" && (
                        <button
                          type="button"
                          className="children-button children-button--ghost"
                          onClick={() => onArchive(item)}
                          aria-label={`Archiver ${item.name}`}
                        >
                          <Archive aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <AdminModal
          title={editing === "nouveau" ? "Nouvelle classe" : "Modifier la classe"}
          onClose={() => setEditing(null)}
        >
          <form
            className="children-form"
            onSubmit={submit}
          >
            {formError && (
              <p className="children-form__error">{formError.message}</p>
            )}

            <label className="children-field">
              <span>Nom de la classe *</span>

              <input
                value={values.name}
                onChange={set("name")}
                required
                maxLength={80}
                placeholder="09 à 12 ans"
              />
            </label>

            <label className="children-field">
              <span>Description</span>

              <input
                value={values.description}
                onChange={set("description")}
                maxLength={400}
              />
            </label>

            <div className="children-form__row">
              <label className="children-field">
                <span>Âge minimum</span>

                <input
                  type="number"
                  min="0"
                  max="25"
                  value={values.ageMin}
                  onChange={set("ageMin")}
                />
              </label>

              <label className="children-field">
                <span>Âge maximum</span>

                <input
                  type="number"
                  min="0"
                  max="25"
                  value={values.ageMax}
                  onChange={set("ageMax")}
                />
              </label>

              <label className="children-field">
                <span>Icône</span>

                <input
                  value={values.icon}
                  onChange={set("icon")}
                  maxLength={8}
                  placeholder="🧸"
                />
              </label>
            </div>

            <div className="children-form__row">
              <label className="children-field">
                <span>Salle</span>

                <input
                  value={values.room}
                  onChange={set("room")}
                  maxLength={120}
                />
              </label>

              <label className="children-field">
                <span>Jour habituel</span>

                <select
                  value={values.usualDay}
                  onChange={set("usualDay")}
                >
                  {DAYS.map((day) => (
                    <option
                      key={day}
                      value={day}
                    >
                      {day}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="children-form__row">
              <label className="children-field">
                <span>Début habituel</span>

                <input
                  value={values.usualStartTime}
                  onChange={set("usualStartTime")}
                  placeholder="09:00"
                  maxLength={10}
                />
              </label>

              <label className="children-field">
                <span>Fin habituelle</span>

                <input
                  value={values.usualEndTime}
                  onChange={set("usualEndTime")}
                  placeholder="11:00"
                  maxLength={10}
                />
              </label>
            </div>

            <div className="children-form__actions">
              <button
                type="button"
                className="children-button"
                onClick={() => setEditing(null)}
              >
                Annuler
              </button>

              <button
                type="submit"
                className="children-button children-button--primary"
                disabled={saving}
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </ChildrenPage>
  );
};

export default ClassesAdmin;
