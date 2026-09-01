import { useCallback, useState } from "react";

import { useNavigate } from "react-router-dom";

import ChildrenPage, {
  ChildrenPanel,
} from "../../../components/children/ChildrenPage";

import useAsyncData from "../../../hooks/useAsyncData";

import { createChild, listClasses } from "../../../services/children";

import "./Children.scss";

// Une seule église pour le moment. Le champ existe en base (1 à 5) et
// tous les écrans du module filtrent déjà dessus, mais tant qu'il n'y
// en a qu'une, un sélecteur ne ferait qu'ajouter une question sans
// réponse au formulaire.
const CHURCH = 1;

const EMPTY = {
  lastName: "",
  firstName: "",
  dateOfBirth: "",
  gender: "",
  birthPlace: "",
  nationality: "",
  homeLanguage: "",
  address: "",
  currentClass: "",
};

const ChildForm = () => {
  const navigate = useNavigate();

  const load = useCallback(() => listClasses(), []);

  const { data: classes } = useAsyncData(load);

  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (event) => {
    const { value } = event.target;

    setValues((current) => ({ ...current, [field]: value }));
  };

  // Message d'erreur propre à un champ, renvoyé par le backend dans
  // `details` (voir child.service.js#assertCreatable). L'afficher sous
  // l'input concerné évite de laisser l'utilisateur relire dix champs
  // pour trouver celui qui coince.
  const fieldError = (field) => error?.details?.[field];

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    // Les champs laissés vides ne sont pas envoyés : une chaîne vide
    // enregistrerait un lieu de naissance « rien » au lieu de laisser
    // le dossier honnêtement incomplet.
    const payload = { church: CHURCH };

    for (const [field, value] of Object.entries(values)) {
      if (value !== "") payload[field] = value;
    }

    try {
      const child = await createChild(payload);

      // Droit sur la fiche : l'enfant vient d'être créé, la première
      // chose à faire est de lui rattacher ses responsables.
      navigate(`/admin/enfants/${child.id}`);
    } catch (caught) {
      setError(caught);
      setSaving(false);
    }
  };

  return (
    <ChildrenPage
      title="Nouvel enfant"
      breadcrumb={[
        { label: "Administration", to: "/admin" },
        { label: "Enfants", to: "/admin/enfants" },
        { label: "Liste", to: "/admin/enfants/liste" },
        { label: "Nouvel enfant" },
      ]}
    >
      <ChildrenPanel title="Informations générales">
        <form
          className="children-form"
          onSubmit={submit}
        >
          {error && !error.details && (
            <p className="children-form__error">{error.message}</p>
          )}

          <div className="children-form__row">
            <label className="children-field">
              <span>Nom *</span>

              <input
                value={values.lastName}
                onChange={set("lastName")}
                required
                maxLength={80}
                autoComplete="off"
              />

              {fieldError("lastName") && (
                <small className="children-field__error">
                  {fieldError("lastName")}
                </small>
              )}
            </label>

            <label className="children-field">
              <span>Prénom(s) *</span>

              <input
                value={values.firstName}
                onChange={set("firstName")}
                required
                maxLength={80}
                autoComplete="off"
              />

              {fieldError("firstName") && (
                <small className="children-field__error">
                  {fieldError("firstName")}
                </small>
              )}
            </label>
          </div>

          <div className="children-form__row">
            <label className="children-field">
              <span>Date de naissance *</span>

              <input
                type="date"
                value={values.dateOfBirth}
                onChange={set("dateOfBirth")}
                required
                // Le schéma refuse une date future et au-delà de 25 ans
                // (Child.js) ; le borner ici évite d'attendre l'aller-
                // retour serveur pour une faute de frappe sur l'année.
                max={new Date().toISOString().slice(0, 10)}
              />

              {fieldError("dateOfBirth") && (
                <small className="children-field__error">
                  {fieldError("dateOfBirth")}
                </small>
              )}
            </label>

            <label className="children-field">
              <span>Sexe *</span>

              <select
                value={values.gender}
                onChange={set("gender")}
                required
              >
                <option value="">À préciser</option>
                <option value="garcon">Garçon</option>
                <option value="fille">Fille</option>
              </select>

              {fieldError("gender") && (
                <small className="children-field__error">
                  {fieldError("gender")}
                </small>
              )}
            </label>
          </div>

          <label className="children-field">
            <span>Classe</span>

            <select
              value={values.currentClass}
              onChange={set("currentClass")}
            >
              <option value="">Non affecté pour le moment</option>

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

          <div className="children-form__row">
            <label className="children-field">
              <span>Lieu de naissance</span>

              <input
                value={values.birthPlace}
                onChange={set("birthPlace")}
                maxLength={160}
              />
            </label>

            <label className="children-field">
              <span>Nationalité</span>

              <input
                value={values.nationality}
                onChange={set("nationality")}
                maxLength={80}
              />
            </label>
          </div>

          <div className="children-form__row">
            <label className="children-field">
              <span>Langue parlée à la maison</span>

              <input
                value={values.homeLanguage}
                onChange={set("homeLanguage")}
                maxLength={80}
              />
            </label>

            <label className="children-field">
              <span>Adresse (si différente du responsable)</span>

              <input
                value={values.address}
                onChange={set("address")}
                maxLength={300}
              />
            </label>
          </div>

          <p className="children-note">
            Les parents et responsables s'ajoutent depuis la fiche, une
            fois l'enfant enregistré. Le numéro de dossier est attribué
            automatiquement.
          </p>

          <div className="children-form__actions">
            <button
              type="button"
              className="children-button"
              onClick={() => navigate("/admin/enfants/liste")}
            >
              Annuler
            </button>

            <button
              type="submit"
              className="children-button children-button--primary"
              disabled={saving}
            >
              {saving ? "Enregistrement…" : "Enregistrer l'enfant"}
            </button>
          </div>
        </form>
      </ChildrenPanel>
    </ChildrenPage>
  );
};

export default ChildForm;
