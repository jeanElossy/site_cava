import { useEffect, useState } from "react";
import {
  KeyRound,
  Pencil,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";

import { agents } from "../../services/api";
import { currentUser } from "../../services/auth";
import usePageMeta from "../../hooks/usePageMeta";
import AdminModal from "../../components/admin/AdminModal";
import { formatRegistrationNumber } from "../../utils/registrationNumber";

import "./AgentsAdmin.scss";

// Rôles gérables depuis cet écran — jamais admin/editor, voir
// agent.service.js côté serveur (même liste, dupliquée ici pour le
// select du formulaire, la vraie barrière reste côté API).
const ROLE_GROUPS = [
  {
    label: "Nouvelles âmes",
    roles: {
      soa: "SOA",
      cana: "CANA",
      coordinateur_bergeries: "Coordonnateur des bergeries",
      pasteur: "Pasteur",
    },
  },
  {
    label: "Service Social",
    roles: {
      social_admin: "Service Social — Admin",
      social_agent: "Service Social — Agent",
      social_approver: "Service Social — Validateur",
      social_viewer: "Service Social — Lecture seule",
    },
  },
];

const ROLE_LABELS = Object.fromEntries(
  ROLE_GROUPS.flatMap((group) => Object.entries(group.roles))
);

const EMPTY_CREATE = { name: "", registrationNumber: "", password: "", role: "soa" };
const EMPTY_EDIT = { name: "", registrationNumber: "", role: "soa" };

// Rôles groupés visuellement dans chaque <select> — huit rôles à plat
// seraient difficiles à parcourir, surtout sur un écran de téléphone.
const RoleOptions = () => (
  <>
    {ROLE_GROUPS.map((group) => (
      <optgroup key={group.label} label={group.label}>
        {Object.entries(group.roles).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </optgroup>
    ))}
  </>
);

const formatLastLogin = (value) =>
  value
    ? new Date(value).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Jamais connecté";

// Page de gestion des comptes SOA/CANA/coordonnateur/pasteur —
// création, modification, activation/désactivation, réinitialisation
// du mot de passe et suppression. Réservée à l'administrateur (voir
// AdminLayout.jsx NAV_GROUPS et backend/src/routes/index.js #
// adminAgents).
const AgentsAdmin = () => {
  usePageMeta({
    title: "Agents — Administration",
    description: "Comptes SOA, CANA, coordonnateur des bergeries, pasteur et Service Social.",
  });

  const currentUserId = currentUser()?.id;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState(EMPTY_CREATE);

  const [editing, setEditing] = useState(null);
  const [editValues, setEditValues] = useState(EMPTY_EDIT);

  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await agents.list({ search, role: roleFilter });
      setItems(data);
    } catch (caught) {
      setError(caught?.message ?? "Impossible de charger les agents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(load, 250);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  const closeAllModals = () => {
    setCreateOpen(false);
    setEditing(null);
    setResetTarget(null);
    setDeleteTarget(null);
    setFormError("");
    setBusy(false);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      await agents.create(createValues);
      setCreateValues(EMPTY_CREATE);
      closeAllModals();
      await load();
    } catch (caught) {
      setFormError(caught?.message ?? "La création a échoué.");
      setBusy(false);
    }
  };

  const openEdit = (agent) => {
    setEditing(agent);
    setEditValues({
      name: agent.name,
      registrationNumber: agent.registrationNumber,
      role: agent.role,
    });
    setFormError("");
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      await agents.update(editing.id, editValues);
      closeAllModals();
      await load();
    } catch (caught) {
      setFormError(caught?.message ?? "La mise à jour a échoué.");
      setBusy(false);
    }
  };

  const toggleActive = async (agent) => {
    setError("");

    try {
      await agents.setActive(agent.id, !agent.isActive);
      await load();
    } catch (caught) {
      setError(caught?.message ?? "Le changement de statut a échoué.");
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      await agents.resetPassword(resetTarget.id, resetPassword);
      setResetPassword("");
      closeAllModals();
    } catch (caught) {
      setFormError(caught?.message ?? "La réinitialisation a échoué.");
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setFormError("");

    try {
      await agents.remove(deleteTarget.id);
      closeAllModals();
      await load();
    } catch (caught) {
      setFormError(caught?.message ?? "La suppression a échoué.");
      setBusy(false);
    }
  };

  return (
    <div className="admin-agents">
      <header>
        <h1>Agents</h1>
        <p className="admin-form__help">
          Comptes SOA, CANA, coordonnateur des bergeries, pasteur et Service Social —
          chacun ne voit, une fois connecté, que son propre module. Connexion par
          matricule (pas d&apos;e-mail nécessaire).
        </p>
      </header>

      <div className="admin-agents__toolbar">
        <div className="admin-form__field">
          <input
            type="search"
            placeholder="Rechercher (nom, matricule)"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="admin-form__field">
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">Tous les rôles</option>
            <RoleOptions />
          </select>
        </div>

        <button
          type="button"
          className="admin-form__button"
          onClick={() => {
            setCreateValues(EMPTY_CREATE);
            setFormError("");
            setCreateOpen(true);
          }}
        >
          + Nouvel agent
        </button>
      </div>

      {error && <p className="admin-form__error">{error}</p>}
      {loading && <p>Chargement…</p>}

      {!loading && items.length === 0 && <p>Aucun agent pour le moment.</p>}

      {!loading && items.length > 0 && (
        <table className="admin-agents__table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Matricule</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Dernière connexion</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((agent) => (
              <tr key={agent.id} className={agent.isActive ? "" : "admin-agents__row--inactive"}>
                <td>{agent.name}</td>
                <td>{formatRegistrationNumber(agent.registrationNumber)}</td>
                <td>{ROLE_LABELS[agent.role] ?? agent.role}</td>
                <td>
                  <span
                    className={`admin-agents__badge${
                      agent.isActive ? " admin-agents__badge--active" : ""
                    }`}
                  >
                    {agent.isActive ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td>{formatLastLogin(agent.lastLoginAt)}</td>
                <td>
                  <div className="admin-agents__row-actions">
                    <button
                      type="button"
                      title="Modifier"
                      aria-label={`Modifier ${agent.name}`}
                      onClick={() => openEdit(agent)}
                    >
                      <Pencil aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      title={agent.isActive ? "Désactiver" : "Réactiver"}
                      aria-label={`${agent.isActive ? "Désactiver" : "Réactiver"} ${agent.name}`}
                      onClick={() => toggleActive(agent)}
                    >
                      {agent.isActive ? (
                        <UserX aria-hidden="true" />
                      ) : (
                        <UserCheck aria-hidden="true" />
                      )}
                    </button>

                    <button
                      type="button"
                      title="Réinitialiser le mot de passe"
                      aria-label={`Réinitialiser le mot de passe de ${agent.name}`}
                      onClick={() => {
                        setResetTarget(agent);
                        setResetPassword("");
                        setFormError("");
                      }}
                    >
                      <KeyRound aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      title="Supprimer"
                      aria-label={`Supprimer ${agent.name}`}
                      className="admin-agents__danger"
                      disabled={agent.id === currentUserId}
                      onClick={() => {
                        setDeleteTarget(agent);
                        setFormError("");
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {createOpen && (
        <AdminModal title="Nouvel agent" onClose={closeAllModals}>
          <form className="admin-form" onSubmit={handleCreate}>
            <div className="admin-form__grid">
              <div className="admin-form__field">
                <label htmlFor="agent-create-name">Nom</label>
                <input
                  id="agent-create-name"
                  type="text"
                  required
                  value={createValues.name}
                  onChange={(event) =>
                    setCreateValues((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>

              <div className="admin-form__field">
                <label htmlFor="agent-create-registration-number">Matricule</label>
                <input
                  id="agent-create-registration-number"
                  type="text"
                  required
                  placeholder="1OL25045S"
                  value={createValues.registrationNumber}
                  onChange={(event) =>
                    setCreateValues((prev) => ({
                      ...prev,
                      registrationNumber: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="admin-form__field">
                <label htmlFor="agent-create-password">Mot de passe</label>
                <input
                  id="agent-create-password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={createValues.password}
                  onChange={(event) =>
                    setCreateValues((prev) => ({ ...prev, password: event.target.value }))
                  }
                />
              </div>

              <div className="admin-form__field">
                <label htmlFor="agent-create-role">Rôle</label>
                <select
                  id="agent-create-role"
                  value={createValues.role}
                  onChange={(event) =>
                    setCreateValues((prev) => ({ ...prev, role: event.target.value }))
                  }
                >
                  <RoleOptions />
                </select>
              </div>
            </div>

            {formError && <p className="admin-form__error">{formError}</p>}

            <div className="admin-form__actions">
              <button
                type="button"
                className="admin-form__button admin-form__button--ghost"
                onClick={closeAllModals}
                disabled={busy}
              >
                Annuler
              </button>
              <button type="submit" className="admin-form__button" disabled={busy}>
                {busy ? "Création…" : "Créer l'agent"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {editing && (
        <AdminModal title={`Modifier ${editing.name}`} onClose={closeAllModals}>
          <form className="admin-form" onSubmit={handleEdit}>
            <div className="admin-form__grid">
              <div className="admin-form__field">
                <label htmlFor="agent-edit-name">Nom</label>
                <input
                  id="agent-edit-name"
                  type="text"
                  required
                  value={editValues.name}
                  onChange={(event) =>
                    setEditValues((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>

              <div className="admin-form__field">
                <label htmlFor="agent-edit-registration-number">Matricule</label>
                <input
                  id="agent-edit-registration-number"
                  type="text"
                  required
                  placeholder="1OL25045S"
                  value={editValues.registrationNumber}
                  onChange={(event) =>
                    setEditValues((prev) => ({
                      ...prev,
                      registrationNumber: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="admin-form__field">
                <label htmlFor="agent-edit-role">Rôle</label>
                <select
                  id="agent-edit-role"
                  value={editValues.role}
                  onChange={(event) =>
                    setEditValues((prev) => ({ ...prev, role: event.target.value }))
                  }
                >
                  <RoleOptions />
                </select>
              </div>
            </div>

            {formError && <p className="admin-form__error">{formError}</p>}

            <div className="admin-form__actions">
              <button
                type="button"
                className="admin-form__button admin-form__button--ghost"
                onClick={closeAllModals}
                disabled={busy}
              >
                Annuler
              </button>
              <button type="submit" className="admin-form__button" disabled={busy}>
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {resetTarget && (
        <AdminModal
          title={`Réinitialiser le mot de passe de ${resetTarget.name}`}
          onClose={closeAllModals}
        >
          <form className="admin-form" onSubmit={handleResetPassword}>
            <p className="admin-form__help">
              Communiquez ce nouveau mot de passe à l'agent par un canal sûr — il n'est
              affiché nulle part ailleurs après cet écran.
            </p>

            <div className="admin-form__field">
              <label htmlFor="agent-reset-password">Nouveau mot de passe</label>
              <input
                id="agent-reset-password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
              />
            </div>

            {formError && <p className="admin-form__error">{formError}</p>}

            <div className="admin-form__actions">
              <button
                type="button"
                className="admin-form__button admin-form__button--ghost"
                onClick={closeAllModals}
                disabled={busy}
              >
                Annuler
              </button>
              <button type="submit" className="admin-form__button" disabled={busy}>
                {busy ? "Réinitialisation…" : "Réinitialiser"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {deleteTarget && (
        <AdminModal title="Confirmer la suppression" onClose={closeAllModals}>
          <p className="admin-agents__confirm">
            <ShieldAlert aria-hidden="true" />
            Voulez-vous vraiment supprimer le compte de « {deleteTarget.name} » ? Cette
            action est définitive.
          </p>

          {formError && <p className="admin-form__error">{formError}</p>}

          <div className="admin-form__actions">
            <button
              type="button"
              className="admin-form__button admin-form__button--ghost"
              onClick={closeAllModals}
              disabled={busy}
            >
              Annuler
            </button>
            <button
              type="button"
              className="admin-agents__danger-button"
              onClick={handleDelete}
              disabled={busy}
            >
              {busy ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default AgentsAdmin;
