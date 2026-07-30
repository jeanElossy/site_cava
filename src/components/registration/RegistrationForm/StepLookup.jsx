import {
  hasValidShape,
  hasValidControlLetter,
  formatRegistrationNumber,
  normalizeRegistrationNumber,
} from "../../../utils/registrationNumber";

const StepLookup = ({ state, dispatch }) => {
  const raw = state.submittedRegistrationNumber;
  const normalized = normalizeRegistrationNumber(raw);
  const showWarning =
    normalized.length > 0 &&
    (!hasValidShape(normalized) || !hasValidControlLetter(normalized));

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
            Je suis nouveau
          </button>

          <button
            type="button"
            className={state.kind === "update" ? "active" : ""}
            onClick={() => dispatch({ type: "SET_KIND", payload: "update" })}
          >
            J&apos;ai déjà un matricule
          </button>
        </div>
      </div>

      {state.kind === "update" && (
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
      )}
    </div>
  );
};

export default StepLookup;
