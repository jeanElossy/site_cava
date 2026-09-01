import { useCallback, useEffect, useState } from "react";

import {
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  Users,
} from "lucide-react";

import ChildrenPage, {
  ChildrenPanel,
  ChildrenStat,
} from "../../../components/children/ChildrenPage";

import AdminModal from "../../../components/admin/AdminModal";
import ChildrenAvatar from "../../../components/children/ChildrenAvatar";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import { currentUser } from "../../../services/auth";
import { CHILDREN_ACCESS_ROLES } from "../../../routes/roleGroups";

import {
  assignMonitor,
  listClasses,
  listMonitors,
  openMonitorAccess,
  resetMonitorPassword,
  searchAssignableMembers,
  updateMonitor,
  withdrawMonitor,
} from "../../../services/children";

import { formatRegistrationNumber } from "../../../utils/registrationNumber";

import "./Children.scss";

/**
 * Moniteurs et monitrices.
 *
 * RÈGLE CENTRALE DU MODULE : un moniteur est TOUJOURS un membre adulte
 * déjà enregistré. Cet écran ne propose donc jamais de créer une
 * personne — seulement de chercher parmi les membres existants, et de
 * leur attribuer une fonction.
 *
 * Trois choses distinctes, et volontairement séparées à l'écran :
 *   la PERSONNE (fiche membre, jamais modifiée ici),
 *   la FONCTION (classe principale, statut),
 *   l'ACCÈS (compte de connexion, mot de passe) — réservé à l'admin.
 */
const MonitorsAdmin = () => {
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Mot de passe temporaire fraîchement créé. Gardé en mémoire le temps
  // de l'afficher, et effacé dès que la fenêtre se ferme : il n'est
  // plus jamais consultable ensuite, ni côté serveur ni ici.
  const [secret, setSecret] = useState(null);

  const role = currentUser()?.role;
  const canManageAccess = CHILDREN_ACCESS_ROLES.includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setItems(
        await listMonitors({
          search: search.trim() || undefined,
          classId: classFilter || undefined,
        })
      );
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [search, classFilter]);

  useEffect(() => {
    listClasses({ status: "published" }).then(setClasses).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, search ? 350 : 0);

    return () => window.clearTimeout(timer);
  }, [load, search]);

  const onOpenAccess = async (assignment) => {
    setSaving(true);
    setFormError(null);

    try {
      const result = await openMonitorAccess(assignment.member.id, {});

      setSecret({
        name: `${assignment.member.firstName} ${assignment.member.lastName}`,
        registrationNumber: assignment.member.registrationNumber,
        password: result.temporaryPassword,
      });

      await load();
    } catch (caught) {
      window.alert(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const onResetPassword = async (assignment) => {
    if (
      !window.confirm(
        `Réinitialiser le mot de passe de ${assignment.member.firstName} ${assignment.member.lastName} ? Sa session en cours sera immédiatement coupée, et il devra choisir un nouveau mot de passe à sa prochaine connexion.`
      )
    ) {
      return;
    }

    try {
      const result = await resetMonitorPassword(assignment.account, {});

      setSecret({
        name: `${assignment.member.firstName} ${assignment.member.lastName}`,
        registrationNumber: assignment.member.registrationNumber,
        password: result.temporaryPassword,
      });

      await load();
    } catch (caught) {
      window.alert(caught.message);
    }
  };

  const onWithdraw = async (assignment) => {
    if (
      !window.confirm(
        `Retirer la fonction de moniteur à ${assignment.member.firstName} ${assignment.member.lastName} ? Sa fiche membre et son compte ne sont pas supprimés.`
      )
    ) {
      return;
    }

    try {
      await withdrawMonitor(assignment.id);

      await load();
    } catch (caught) {
      window.alert(caught.message);
    }
  };

  // ---- Affectation d'un nouveau moniteur --------------------------
  //
  // L'écran ne savait que MODIFIER une affectation existante : il n'y
  // avait aucun moyen d'en créer une, donc la liste restait vide et la
  // recherche ne pouvait rien trouver.
  const [assigning, setAssigning] = useState(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!assigning) return undefined;

    const needle = memberQuery.trim();

    // Sous deux caractères on ne cherche pas — et on ne vide pas non
    // plus l'état ici : un `setState` synchrone dans un effet
    // déclenche un rendu en cascade. La liste affichée est DÉRIVÉE
    // (`visibleCandidates` plus bas), ce qui rend l'effacement inutile.
    if (needle.length < 2) return undefined;

    // Recherche différée : chaque frappe déclencherait sinon une
    // requête, et les réponses pourraient revenir dans le désordre.
    const timer = window.setTimeout(async () => {
      setSearching(true);

      try {
        setCandidates(await searchAssignableMembers({ search: needle }));
      } catch {
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [assigning, memberQuery]);

  // Ce que l'on montre réellement : les résultats ne valent que pour
  // une recherche encore assez longue pour les avoir produits.
  const visibleCandidates =
    memberQuery.trim().length >= 2 ? candidates : [];

  const openAssign = () => {
    setAssigning({ member: null, classId: "", level: "moniteur" });
    setMemberQuery("");
    setCandidates([]);
    setFormError(null);
  };

  const submitAssign = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      await assignMonitor({
        memberId: assigning.member.id,
        classId: assigning.classId,
        level: assigning.level,
      });

      setAssigning(null);

      await load();
    } catch (caught) {
      setFormError(caught);
    } finally {
      setSaving(false);
    }
  };

  const submitClassChange = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      await updateMonitor(editing.id, {
        classId: editing.classId,
        level: editing.level,
      });

      setEditing(null);

      await load();
    } catch (caught) {
      setFormError(caught);
    } finally {
      setSaving(false);
    }
  };

  const active = items.filter((item) => item.status === "active");

  const withoutAccess = active.filter((item) => !item.account).length;

  return (
    <ChildrenPage
      title="Moniteurs / Monitrices"
      breadcrumb={[
        { label: "Administration", to: "/admin" },
        { label: "Enfants", to: "/admin/enfants" },
        { label: "Moniteurs" },
      ]}
      action={
        canManageAccess && (
          <button
            type="button"
            className="children-button children-button--primary"
            onClick={openAssign}
          >
            <Plus aria-hidden="true" />
            Affecter un moniteur
          </button>
        )
      }
      stats={
        <>
          <ChildrenStat
            icon={Users}
            value={active.length}
            label="Moniteurs en exercice"
          />

          <ChildrenStat
            icon={ShieldCheck}
            value={active.length - withoutAccess}
            label="Accès ouverts"
            tone="success"
          />

          <ChildrenStat
            icon={KeyRound}
            value={withoutAccess}
            label="Sans accès"
            tone="warning"
          />
        </>
      }
      filters={
        <>
          <label className="children-field children-field--search">
            <span>Rechercher</span>

            <span className="children-field__control">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom ou matricule"
              />
            </span>
          </label>

          <label className="children-field">
            <span>Classe principale</span>

            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
            >
              <option value="">Toutes</option>

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
        </>
      }
      aside={
        <ChildrenPanel title="Comment ça marche">
          <p className="children-note">
            Un moniteur est <strong>toujours un membre adulte déjà
            enregistré</strong>. Attribuer la fonction ne crée jamais une
            seconde fiche : le membre garde son matricule, et c&apos;est avec
            lui qu&apos;il se connecte.
          </p>

          <p className="children-note">
            La <strong>fonction</strong> et l&apos;<strong>accès</strong> sont
            deux choses distinctes. On peut être moniteur sans jamais se
            connecter, et retirer un accès sans retirer la classe.
          </p>
        </ChildrenPanel>
      }
    >
      {loading && <AdminLoading />}

      {error && (
        <AdminError
          message={error.message}
          onRetry={load}
        />
      )}

      {!loading && !error && items.length === 0 && (
        <AdminEmpty message="Aucun moniteur pour le moment. Attribuez la fonction à un membre depuis sa fiche, ou depuis cet écran." />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="children-table-wrap">
          <table className="children-table">
            <thead>
              <tr>
                <th>Moniteur</th>
                <th>Matricule</th>
                <th>Classe principale</th>
                <th>Fonction</th>
                <th>Accès</th>
                <th aria-label="Actions" />
              </tr>
            </thead>

            <tbody>
              {items.map((assignment) => (
                <tr key={assignment.id}>
                  <td>
                    <span className="children-person">
                      <ChildrenAvatar
                        firstName={assignment.member?.firstName}
                        lastName={assignment.member?.lastName}
                        photo={assignment.member?.photo}
                        size="md"
                      />

                      <span>
                        <strong>
                          {assignment.member?.firstName}{" "}
                          {assignment.member?.lastName}
                        </strong>

                        <em>
                          {assignment.level === "secondaire"
                            ? "Moniteur secondaire"
                            : "Moniteur principal"}
                        </em>
                      </span>
                    </span>
                  </td>

                  <td className="children-table__mono">
                    {assignment.member?.registrationNumber
                      ? formatRegistrationNumber(
                          assignment.member.registrationNumber
                        )
                      : "—"}
                  </td>

                  <td>
                    {assignment.primaryClass ? (
                      <span className="children-classcell">
                        <span
                          className="children-classcell__icon"
                          aria-hidden="true"
                        >
                          {assignment.primaryClass.icon || "👶"}
                        </span>

                        <span>
                          <strong>{assignment.primaryClass.name}</strong>

                          {assignment.primaryClass.room && (
                            <em>{assignment.primaryClass.room}</em>
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="children-table__muted">—</span>
                    )}
                  </td>

                  <td>
                    <span
                      className={
                        assignment.status === "active"
                          ? "children-badge children-badge--success"
                          : "children-badge children-badge--muted"
                      }
                    >
                      {assignment.status === "active"
                        ? "Active"
                        : assignment.status === "suspendue"
                          ? "Suspendue"
                          : "Retirée"}
                    </span>
                  </td>

                  <td>
                    {assignment.account ? (
                      <span className="children-badge children-badge--info">
                        Ouvert
                      </span>
                    ) : (
                      <span className="children-badge children-badge--muted">
                        Aucun
                      </span>
                    )}
                  </td>

                  <td>
                    <div className="children-table__actions">
                      <button
                        type="button"
                        className="children-button children-button--ghost"
                        onClick={() =>
                          setEditing({
                            id: assignment.id,
                            classId: assignment.primaryClass?.id ?? "",
                            level: assignment.level ?? "principal",
                            name: `${assignment.member?.firstName} ${assignment.member?.lastName}`,
                          })
                        }
                        aria-label="Modifier la classe principale"
                      >
                        <Pencil aria-hidden="true" />
                      </button>

                      {canManageAccess && !assignment.account && (
                        <button
                          type="button"
                          className="children-button children-button--ghost"
                          onClick={() => onOpenAccess(assignment)}
                          disabled={saving}
                          aria-label="Créer l'accès"
                          title="Créer l'accès à l'espace moniteur"
                        >
                          <KeyRound aria-hidden="true" />
                        </button>
                      )}

                      {canManageAccess && assignment.account && (
                        <button
                          type="button"
                          className="children-button children-button--ghost"
                          onClick={() => onResetPassword(assignment)}
                          aria-label="Réinitialiser le mot de passe"
                          title="Réinitialiser le mot de passe"
                        >
                          <RefreshCw aria-hidden="true" />
                        </button>
                      )}

                      {assignment.status === "active" && (
                        <button
                          type="button"
                          className="children-button children-button--ghost"
                          onClick={() => onWithdraw(assignment)}
                          aria-label="Retirer la fonction"
                          title="Retirer la fonction de moniteur"
                        >
                          <UserMinus aria-hidden="true" />
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

      {/* Mot de passe temporaire — affiché UNE SEULE FOIS. */}
      {secret && (
        <AdminModal
          title="Accès créé"
          onClose={() => setSecret(null)}
        >
          <div className="children-secret">
            <h3>Mot de passe temporaire de {secret.name}</h3>

            <p>
              Communiquez-le maintenant : il ne sera <strong>plus jamais
              affiché</strong>. {secret.name.split(" ")[0]} devra choisir un
              nouveau mot de passe dès sa première connexion.
            </p>

            <code className="children-secret__value">{secret.password}</code>
          </div>

          <p className="children-form__hint">
            Identifiant de connexion :{" "}
            <strong>
              {secret.registrationNumber
                ? formatRegistrationNumber(secret.registrationNumber)
                : "—"}
            </strong>{" "}
            — c&apos;est son matricule de membre, pas un nouvel identifiant.
          </p>

          <div className="children-form__actions">
            <button
              type="button"
              className="children-button children-button--primary"
              onClick={() => setSecret(null)}
            >
              J&apos;ai noté le mot de passe
            </button>
          </div>
        </AdminModal>
      )}

      {assigning && (
        <AdminModal
          title="Affecter un moniteur"
          description="Un moniteur est toujours un membre adulte déjà enregistré : il n'y a pas de second compte à créer."
          onClose={() => setAssigning(null)}
        >
          <form
            className="children-form"
            onSubmit={submitAssign}
          >
            {formError && (
              <p className="children-form__error">{formError.message}</p>
            )}

            <label className="children-field">
              <span>Rechercher le membre *</span>

              <input
                type="search"
                value={memberQuery}
                onChange={(event) => {
                  setMemberQuery(event.target.value);

                  // Changer la recherche annule le choix précédent :
                  // sinon on pourrait valider un membre qui n'est plus
                  // affiché à l'écran.
                  setAssigning((current) => ({ ...current, member: null }));
                }}
                placeholder="Nom ou matricule (1ME 19-016 P)"
                autoComplete="off"
              />
            </label>

            {memberQuery.trim().length > 0 && memberQuery.trim().length < 2 && (
              <p className="children-note">Saisissez au moins deux caractères.</p>
            )}

            {searching && <AdminLoading />}

            {!searching && memberQuery.trim().length >= 2 && visibleCandidates.length === 0 && (
              <p className="children-note">
                Aucun membre actif ne correspond. Le moniteur doit d'abord être
                enregistré dans l'annuaire des membres.
              </p>
            )}

            {visibleCandidates.length > 0 && (
              <ul className="children-picker">
                {visibleCandidates.map((member) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      className={
                        assigning.member?.id === member.id
                          ? "children-picker__item children-picker__item--on"
                          : "children-picker__item"
                      }
                      // Un membre déjà moniteur reste VISIBLE mais non
                      // sélectionnable : le masquer ferait conclure à
                      // tort qu'il n'est pas dans l'annuaire.
                      disabled={member.alreadyMonitor}
                      onClick={() =>
                        setAssigning((current) => ({ ...current, member }))
                      }
                    >
                      <ChildrenAvatar
                        photo={member.photo}
                        firstName={member.firstName}
                        lastName={member.lastName}
                      />

                      <span>
                        <strong>
                          {member.firstName} {member.lastName}
                        </strong>

                        <small className="children-table__muted">
                          {member.registrationNumber
                            ? formatRegistrationNumber(member.registrationNumber)
                            : "—"}

                          {member.alreadyMonitor &&
                            ` · déjà moniteur${
                              member.currentClassName
                                ? ` (${member.currentClassName})`
                                : ""
                            }`}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="children-field">
              <span>Classe principale *</span>

              <select
                value={assigning.classId}
                onChange={(event) =>
                  setAssigning((current) => ({
                    ...current,
                    classId: event.target.value,
                  }))
                }
                required
              >
                <option value="">Choisir une classe</option>

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
              <span>Niveau</span>

              <select
                value={assigning.level}
                onChange={(event) =>
                  setAssigning((current) => ({
                    ...current,
                    level: event.target.value,
                  }))
                }
              >
                <option value="moniteur">Moniteur</option>
                <option value="assistant">Assistant</option>
                <option value="responsable">Responsable de classe</option>
              </select>
            </label>

            <p className="children-note">
              L'affectation ne crée pas l'accès à l'espace moniteur : elle
              donne la fonction. L'accès s'ouvre ensuite depuis la liste, et
              c'est là qu'apparaît le mot de passe temporaire.
            </p>

            <div className="children-form__actions">
              <button
                type="button"
                className="children-button"
                onClick={() => setAssigning(null)}
              >
                Annuler
              </button>

              <button
                type="submit"
                className="children-button children-button--primary"
                disabled={saving || !assigning.member || !assigning.classId}
              >
                {saving ? "Enregistrement…" : "Affecter"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {editing && (
        <AdminModal
          title={`Classe principale — ${editing.name}`}
          onClose={() => setEditing(null)}
        >
          <form
            className="children-form"
            onSubmit={submitClassChange}
          >
            {formError && (
              <p className="children-form__error">{formError.message}</p>
            )}

            <label className="children-field">
              <span>Classe principale</span>

              <select
                value={editing.classId}
                onChange={(event) =>
                  setEditing((current) => ({
                    ...current,
                    classId: event.target.value,
                  }))
                }
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

            <p className="children-form__hint">
              Changer la classe principale ne touche à aucun remplacement en
              cours : un remplacement est temporaire et vit à côté de
              l&apos;affectation.
            </p>

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

export default MonitorsAdmin;
