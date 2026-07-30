import { useEffect, useRef, useState } from "react";

import { IdCard, Sparkles, CheckCircle2 } from "lucide-react";

import {
  hasValidShape,
  hasValidControlLetter,
  formatRegistrationNumber,
  normalizeRegistrationNumber,
} from "../../../utils/registrationNumber";

import { memberSubmissions } from "../../../services/api";
import { memberToFormData } from "./data";

// Délai avant de lancer la recherche une fois le matricule ET le nom
// stabilisés : évite un appel réseau à chaque frappe.
const LOOKUP_DELAY_MS = 600;

const StepLookup = ({ state, dispatch, updateData }) => {
  const raw = state.submittedRegistrationNumber;
  const normalized = normalizeRegistrationNumber(raw);
  const validShape =
    hasValidShape(normalized) && hasValidControlLetter(normalized);
  const showWarning = normalized.length > 0 && !validShape;
  const lastName = state.data.lastName.trim();

  // Le pré-remplissage exige matricule ET nom de famille exact : un
  // matricule seul est un identifiant séquentiel, donc partiellement
  // devinable (voir submission.service.js#lookup côté serveur). Sans
  // cette double condition, quiconque saisirait un matricule au hasard
  // verrait apparaître la fiche complète de son propriétaire.
  const canLookup = state.kind === "update" && validShape && lastName.length >= 2;

  // idle | searching | found | not-found — dernier essai de recherche.
  // N'a de sens que quand `canLookup` est vrai : tant que ce n'est pas
  // le cas, `lookupStatus` (ci-dessous) retombe sur "idle" par simple
  // dérivation au rendu, sans passer par un `setState` synchrone dans
  // l'effet (ce que déclenchaient les anciens retours anticipés).
  const [internalStatus, setInternalStatus] = useState("idle");
  const lookupStatus = canLookup ? internalStatus : "idle";

  const timerRef = useRef(null);
  const lastAttemptRef = useRef("");

  useEffect(() => {
    if (!canLookup) return undefined;

    const attemptKey = `${normalized}|${lastName.toLowerCase()}`;

    if (attemptKey === lastAttemptRef.current) return undefined;

    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      lastAttemptRef.current = attemptKey;
      setInternalStatus("searching");

      try {
        const result = await memberSubmissions.lookup(normalized, lastName);

        if (result) {
          updateData(memberToFormData(result));
          setInternalStatus("found");
        } else {
          setInternalStatus("not-found");
        }
      } catch {
        setInternalStatus("not-found");
      }
    }, LOOKUP_DELAY_MS);

    return () => clearTimeout(timerRef.current);
  }, [canLookup, normalized, lastName, updateData]);

  return (
    <div className="step-panel">
      <div className="form-group">
        <label>Votre situation</label>

        <div className="kind-grid">
          <button
            type="button"
            className={state.kind === "new" ? "active" : ""}
            onClick={() => dispatch({ type: "SET_KIND", payload: "new" })}
          >
            <Sparkles aria-hidden="true" />
            <span className="kind-grid__title">Je suis nouveau</span>
            <span className="kind-grid__hint">
              Première inscription à CAVA
            </span>
          </button>

          <button
            type="button"
            className={state.kind === "update" ? "active" : ""}
            onClick={() => dispatch({ type: "SET_KIND", payload: "update" })}
          >
            <IdCard aria-hidden="true" />
            <span className="kind-grid__title">
              J&apos;ai déjà un matricule
            </span>
            <span className="kind-grid__hint">
              Compléter ou corriger ma fiche
            </span>
          </button>
        </div>
      </div>

      {state.kind === "update" && (
        <>
          <div className="form-group">
            <label htmlFor="registration-number">Votre matricule</label>

            <input
              id="registration-number"
              type="text"
              placeholder="1OL 16-005 E"
              value={raw}
              onChange={(event) =>
                dispatch({
                  type: "SET_SUBMITTED_REGISTRATION_NUMBER",
                  payload: event.target.value,
                })
              }
            />

            {normalized && !showWarning && (
              <p className="registration-preview">
                Format reconnu : {formatRegistrationNumber(normalized)}
              </p>
            )}

            {showWarning && (
              <p className="registration-warning">
                Ce format ne ressemble pas à un matricule CAVA valide.
                Vous pouvez continuer : l&apos;équipe vérifiera à la
                réception de votre demande.
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reg-lookup-lastName">
              Votre nom de famille
            </label>

            <input
              id="reg-lookup-lastName"
              type="text"
              placeholder="Tel qu'inscrit sur votre carte de membre"
              value={state.data.lastName}
              onChange={(event) =>
                updateData({ lastName: event.target.value })
              }
            />

            <p className="field-help">
              Sert uniquement à retrouver votre fiche si elle existe
              déjà — le matricule seul ne suffit pas.
            </p>
          </div>

          {lookupStatus === "searching" && (
            <p className="lookup-status lookup-status--searching">
              Recherche de votre fiche…
            </p>
          )}

          {lookupStatus === "found" && (
            <p className="lookup-status lookup-status--found">
              <CheckCircle2 aria-hidden="true" />
              Nous avons retrouvé votre fiche : les champs déjà connus
              ont été pré-remplis ci-après. Vérifiez-les et complétez
              le reste.
            </p>
          )}

          {lookupStatus === "not-found" && (
            <p className="lookup-status lookup-status--not-found">
              Aucune fiche ne correspond à ce matricule et ce nom pour
              le moment — continuez simplement à remplir le formulaire,
              l&apos;équipe vérifiera à la réception.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default StepLookup;
