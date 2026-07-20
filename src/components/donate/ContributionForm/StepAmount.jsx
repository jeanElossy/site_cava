import { amounts, projects } from "./data";

// Étape 1 : fréquence, montant, affectation.
const StepAmount = ({ state, dispatch, onEdit }) => (
  <div className="step-panel">

    <div className="form-group">

      <label id="label-frequence">Fréquence</label>

      <div
        className="frequency-grid"
        role="group"
        aria-labelledby="label-frequence"
      >

        <button
          type="button"
          className={!state.recurring ? "active" : ""}
          aria-pressed={!state.recurring}
          onClick={() =>
            dispatch({
              type: "SET_RECURRING",
              payload: false,
            })
          }
        >
          Unique
        </button>

        <button
          type="button"
          className={state.recurring ? "active" : ""}
          aria-pressed={state.recurring}
          onClick={() =>
            dispatch({
              type: "SET_RECURRING",
              payload: true,
            })
          }
        >
          Mensuelle
        </button>

      </div>

    </div>

    <div className="form-group">

      <label
        id="label-montant"
        htmlFor="montant-libre"
      >
        Montant
      </label>

      <div
        className="amount-grid"
        role="group"
        aria-labelledby="label-montant"
      >

        {amounts.map((amount) => (
          <button
            type="button"
            key={amount}
            className={
              state.amount === amount ? "active" : ""
            }
            aria-pressed={state.amount === amount}
            onClick={() =>
              dispatch({
                type: "SET_AMOUNT",
                payload: amount,
              })
            }
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
          dispatch({
            type: "SET_AMOUNT",
            payload: e.target.value,
          });

          onEdit();
        }}
      />

    </div>

    <div className="form-group">

      <label htmlFor="affectation">Affectation</label>

      <select
        id="affectation"
        value={state.project}
        onChange={(e) =>
          dispatch({
            type: "SET_PROJECT",
            payload: e.target.value,
          })
        }
      >
        {projects.map((project) => (
          <option
            key={project.value}
            value={project.value}
          >
            {project.label}
          </option>
        ))}
      </select>

    </div>

  </div>
);

export default StepAmount;
