import { useCallback, useEffect, useState } from "react";

import { Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";

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

import useAsyncData from "../../../hooks/useAsyncData";

import {
  createGuardian,
  deleteGuardian,
  listGuardians,
  updateGuardian,
} from "../../../services/children";

import "./Children.scss";

const EMPTY = {
  firstName: "",
  lastName: "",
  phone: "",
  whatsapp: "",
  email: "",
  area: "",
  address: "",
  memberRegistrationNumber: "",
};

/**
 * Annuaire des parents et responsables.
 *
 * COLLECTION PARTAGÉE, et le registre réel le justifie : sept enfants
 * LIADE, quatre ZADI, trois ADJAFFI. Saisir les mêmes parents dans
 * chaque fiche, ce serait sept numéros de téléphone à corriger le jour
 * d'un déménagement — et sept occasions de diverger.
 */
const GuardiansAdmin = () => {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // La recherche est temporisée AVANT d'entrer dans le chargeur :
  // sans ça, chaque frappe déclencherait une requête, et les réponses
  // reviendraient dans le désordre.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    () => listGuardians({ search: debounced || undefined, page, limit: 25 }),
    [debounced, page]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  const items = data?.items ?? [];
  const meta = data?.meta ?? null;

  const openCreate = () => {
    setValues(EMPTY);
    setEditing("nouveau");
    setFormError(null);
  };

  const openEdit = (item) => {
    setValues({
      firstName: item.firstName ?? "",
      lastName: item.lastName ?? "",
      phone: item.phone ?? "",
      whatsapp: item.whatsapp ?? "",
      email: item.email ?? "",
      area: item.area ?? "",
      address: item.address ?? "",
      memberRegistrationNumber: "",
    });

    setEditing(item.id);
    setFormError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      if (editing === "nouveau") {
        await createGuardian(values);
      } else {
        await updateGuardian(editing, values);
      }

      setEditing(null);

      reload();
    } catch (caught) {
      setFormError(caught);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item) => {
    if (
      !window.confirm(
        `Supprimer ${item.firstName} ${item.lastName} de l'annuaire des responsables ?`
      )
    ) {
      return;
    }

    try {
      await deleteGuardian(item.id);

      reload();
    } catch (caught) {
      // Le serveur refuse la suppression tant que des enfants sont
      // rattachés : son message dit combien, ce qui est plus utile
      // qu'un « impossible » générique.
      window.alert(caught.message);
    }
  };

  const set = (field) => (event) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const linkedToMember = items.filter((item) => item.member).length;

  return (
    <ChildrenPage
      title="Parents / Responsables"
      breadcrumb={[
        { label: "Administration", to: "/admin" },
        { label: "Enfants", to: "/admin/enfants" },
        { label: "Responsables" },
      ]}
      action={
        <button
          type="button"
          className="children-button children-button--primary"
          onClick={openCreate}
        >
          <Plus aria-hidden="true" />
          Ajouter un responsable
        </button>
      }
      stats={
        <>
          <ChildrenStat
            icon={Users}
            value={meta?.total ?? 0}
            label="Responsables enregistrés"
          />

          <ChildrenStat
            icon={ShieldCheck}
            value={linkedToMember}
            label="Déjà membres CAVA (page affichée)"
            tone="success"
          />
        </>
      }
      filters={
        <label className="children-field children-field--search">
          <span>Rechercher</span>

          <span className="children-field__control">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom, prénom ou téléphone"
            />
          </span>
        </label>
      }
      aside={
        <ChildrenPanel title="Parent déjà membre CAVA">
          <p className="children-note">
            Renseignez son <strong>matricule</strong> : sa fiche membre est
            alors reliée, et son identité n&apos;est pas saisie deux fois.
            Laissez vide pour un responsable externe — une grand-mère, une
            nourrice, un tuteur.
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
        <AdminEmpty message="Aucun responsable enregistré pour le moment." />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="children-table-wrap">
            <table className="children-table">
              <thead>
                <tr>
                  <th>Responsable</th>
                  <th>Téléphone</th>
                  <th>Quartier</th>
                  <th>Enfants</th>
                  <th>Membre CAVA</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="children-person">
                        <ChildrenAvatar
                          firstName={item.firstName}
                          lastName={item.lastName}
                          size="md"
                        />

                        <span>
                          <strong>
                            {item.firstName} {item.lastName}
                          </strong>

                          {item.email && <em>{item.email}</em>}
                        </span>
                      </span>
                    </td>

                    <td className="children-table__mono">
                      {item.phone || <span className="children-table__muted">—</span>}
                    </td>

                    <td>
                      {item.area || <span className="children-table__muted">—</span>}
                    </td>

                    <td>
                      {item.childCount > 0 ? (
                        <span className="children-daycell">
                          <span className="children-daycell__date">
                            {item.childCount} enfant
                            {item.childCount > 1 ? "s" : ""}
                          </span>

                          <span className="children-daycell__range">
                            {item.childNames.join(", ")}
                          </span>
                        </span>
                      ) : (
                        <span className="children-table__muted">Aucun</span>
                      )}
                    </td>

                    <td>
                      {item.member ? (
                        <span className="children-badge children-badge--success">
                          Oui
                        </span>
                      ) : (
                        <span className="children-badge children-badge--muted">
                          Externe
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="children-table__actions">
                        <button
                          type="button"
                          className="children-button children-button--ghost"
                          onClick={() => openEdit(item)}
                          aria-label={`Modifier ${item.firstName} ${item.lastName}`}
                        >
                          <Pencil aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          className="children-button children-button--ghost"
                          onClick={() => onDelete(item)}
                          aria-label={`Supprimer ${item.firstName} ${item.lastName}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.pages > 1 && (
            <nav
              className="children-pagination"
              aria-label="Pagination"
            >
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={meta.page <= 1}
              >
                Précédent
              </button>

              <span>
                Page {meta.page} sur {meta.pages} — {meta.total} responsable
                {meta.total > 1 ? "s" : ""}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(meta.pages, current + 1))
                }
                disabled={meta.page >= meta.pages}
              >
                Suivant
              </button>
            </nav>
          )}
        </>
      )}

      {editing && (
        <AdminModal
          title={
            editing === "nouveau" ? "Nouveau responsable" : "Modifier le responsable"
          }
          onClose={() => setEditing(null)}
        >
          <form
            className="children-form"
            onSubmit={submit}
          >
            {formError && (
              <p className="children-form__error">{formError.message}</p>
            )}

            <div className="children-form__row">
              <label className="children-field">
                <span>Nom *</span>

                <input
                  value={values.lastName}
                  onChange={set("lastName")}
                  required
                  maxLength={80}
                />
              </label>

              <label className="children-field">
                <span>Prénom *</span>

                <input
                  value={values.firstName}
                  onChange={set("firstName")}
                  required
                  maxLength={80}
                />
              </label>
            </div>

            <div className="children-form__row">
              <label className="children-field">
                <span>Téléphone</span>

                <input
                  value={values.phone}
                  onChange={set("phone")}
                  maxLength={40}
                />
              </label>

              <label className="children-field">
                <span>WhatsApp</span>

                <input
                  value={values.whatsapp}
                  onChange={set("whatsapp")}
                  maxLength={40}
                />
              </label>
            </div>

            <label className="children-field">
              <span>Adresse e-mail</span>

              <input
                type="email"
                value={values.email}
                onChange={set("email")}
              />
            </label>

            <div className="children-form__row">
              <label className="children-field">
                <span>Quartier</span>

                <input
                  value={values.area}
                  onChange={set("area")}
                  maxLength={120}
                />
              </label>

              <label className="children-field">
                <span>Adresse</span>

                <input
                  value={values.address}
                  onChange={set("address")}
                  maxLength={300}
                />
              </label>
            </div>

            <label className="children-field">
              <span>Matricule, si ce parent est déjà membre CAVA</span>

              <input
                value={values.memberRegistrationNumber}
                onChange={set("memberRegistrationNumber")}
                placeholder="1ME 19-016 P"
                autoCapitalize="characters"
              />
            </label>

            <p className="children-form__hint">
              Renseigné, le matricule relie la fiche membre existante et
              reprend ses coordonnées. Laissez vide pour un responsable qui
              n&apos;est pas membre.
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

export default GuardiansAdmin;
