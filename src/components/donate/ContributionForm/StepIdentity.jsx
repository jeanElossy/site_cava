import { useEffect, useRef } from "react";

import { Sprout } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import useAsyncData from "../../../hooks/useAsyncData";
import { fetchDonationTypes } from "../../../services/donations";

import { amounts } from "./data";

const fields = [
  { key: "firstName", label: "Prénom", autoComplete: "given-name", type: "text" },
  { key: "lastName", label: "Nom", autoComplete: "family-name", type: "text" },
  { key: "phone", label: "Téléphone", autoComplete: "tel", type: "tel" },
  { key: "email", label: "Email (optionnel)", autoComplete: "email", type: "email" },
];

// Étape 1 : coordonnées, montant, type de don — la « semence » du
// parcours (voir la section Design visuel de la spec).
const StepIdentity = ({ state, dispatch, updateDonor, onEdit }) => {
  const { data: types, loading, error } = useAsyncData(fetchDonationTypes);

  const [searchParams] = useSearchParams();

  // Préremplissage depuis l'URL — c'est tout l'intérêt du QR code
  // projeté pendant un culte (GET /admin/donations/qrcode encode
  // `/donate?type=<nom>`) : le visiteur arrive avec son type déjà
  // choisi.
  //
  // Le rapprochement se fait sur le NOM du type, pas sur son
  // identifiant Mongo : c'est le nom qu'un administrateur choisit dans
  // la fenêtre de génération du QR, et c'est lui qui reste lisible
  // dans l'URL. La comparaison ignore la casse et les espaces de
  // bordure — une URL recopiée à la main n'a pas à être exacte au
  // caractère près.
  //
  // Le rapprochement n'est possible qu'APRÈS la réponse de l'API :
  // c'est elle qui fait autorité sur les types existants (ils sont
  // administrables), pas une liste écrite en dur ici.
  const pendingTypeName = searchParams.get("type");

  // Une seule application par montage : sans ce garde, revenir sur
  // cette étape après avoir changé de type dans le sélecteur
  // réimposerait celui de l'URL.
  const prefillDone = useRef(false);

  useEffect(() => {
    if (prefillDone.current) return;
    if (!types || !pendingTypeName) return;

    // Un choix déjà fait par le visiteur prime toujours sur l'URL.
    if (state.donationType.id) return;

    const wanted = pendingTypeName.trim().toLowerCase();
    const match = types.find(
      (type) => String(type.name ?? "").trim().toLowerCase() === wanted
    );

    prefillDone.current = true;

    if (!match) return;

    dispatch({
      type: "SET_DONATION_TYPE",
      payload: { id: match.id, name: match.name },
    });
  }, [types, pendingTypeName, state.donationType.id, dispatch]);

  return (
    <div className="step-panel">

      <div className="form-group">
        <label>Vos informations</label>

        <div className="donor-grid">
          {fields.map((field) => (
            <input
              key={field.key}
              type={field.type}
              placeholder={field.label}
              aria-label={field.label}
              autoComplete={field.autoComplete}
              value={state.donor[field.key]}
              onChange={(e) => updateDonor(field.key, e.target.value)}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="donation-type">Type de don</label>

        {loading && <p className="step-panel__hint">Chargement des types de don…</p>}
        {error && <p className="step-panel__hint step-panel__hint--error">{error}</p>}

        {types && (
          <select
            id="donation-type"
            value={state.donationType.id}
            onChange={(e) => {
              const chosen = types.find((t) => t.id === e.target.value);

              dispatch({
                type: "SET_DONATION_TYPE",
                payload: chosen ? { id: chosen.id, name: chosen.name } : { id: "", name: "" },
              });
            }}
          >
            <option value="">Choisir un type de don</option>

            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="form-group">
        <label id="label-montant" htmlFor="montant-libre">
          Montant
        </label>

        <div className="amount-grid" role="group" aria-labelledby="label-montant">
          {amounts.map((amount) => (
            <button
              type="button"
              key={amount}
              className={state.amount === amount ? "active" : ""}
              aria-pressed={state.amount === amount}
              onClick={() => dispatch({ type: "SET_AMOUNT", payload: amount })}
            >
              {amount.toLocaleString()}
            </button>
          ))}
        </div>

        <input
          id="montant-libre"
          type="number"
          min="0"
          value={state.amount}
          placeholder="Autre montant"
          onChange={(e) => {
            dispatch({ type: "SET_AMOUNT", payload: e.target.value });
            onEdit();
          }}
        />
      </div>

      <p className="step-panel__growth-hint">
        <Sprout size={15} aria-hidden="true" />
        Comme une semence, votre don grandit — choisissez ensuite comment le faire parvenir.
      </p>

    </div>
  );
};

export default StepIdentity;
