import { useEffect, useState } from "react";

import { flocks as flocksApi } from "../../../services/api";
import PhotoField from "./PhotoField";

// La liste des églises est chargée UNE SEULE FOIS par l'orchestrateur
// (index.jsx) et transmise en prop — voir le commentaire à cet endroit
// pour la raison de ce choix (éviter un fetch redondant par étape).
const StepIdentity = ({ state, updateData, churchOptions }) => {
  const [flockOptions, setFlockOptions] = useState([]);
  const [loadingFlocks, setLoadingFlocks] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Enveloppé dans une fonction interne (comme ApiStatus/index.jsx)
    // plutôt qu'un appel direct dans le corps de l'effet : la même
    // fonction gère aussi bien la remise à zéro (aucune église choisie)
    // que le chargement, sans jamais appeler `setState` de façon
    // synchrone dans le corps de l'effet lui-même.
    const loadFlocks = async () => {
      if (!state.data.church) {
        if (!cancelled) setFlockOptions([]);

        return;
      }

      if (!cancelled) setLoadingFlocks(true);

      try {
        const items = await flocksApi.list({ church: state.data.church });

        if (!cancelled) setFlockOptions(items);
      } catch {
        if (!cancelled) setFlockOptions([]);
      } finally {
        if (!cancelled) setLoadingFlocks(false);
      }
    };

    loadFlocks();

    return () => {
      cancelled = true;
    };
  }, [state.data.church]);

  return (
    <div className="step-panel">
      <PhotoField
        value={state.data.photo}
        onChange={(photo) => updateData({ photo })}
      />

      <div className="form-group">
        <label htmlFor="reg-firstName">Prénom</label>
        <input
          id="reg-firstName"
          type="text"
          value={state.data.firstName}
          onChange={(event) => updateData({ firstName: event.target.value })}
        />
      </div>

      <div className="form-group">
        <label htmlFor="reg-lastName">Nom</label>
        <input
          id="reg-lastName"
          type="text"
          value={state.data.lastName}
          onChange={(event) => updateData({ lastName: event.target.value })}
        />
      </div>

      <div className="form-group">
        <label htmlFor="reg-church">Église</label>
        <select
          id="reg-church"
          value={state.data.church}
          onChange={(event) =>
            updateData({ church: event.target.value, flock: "" })
          }
        >
          <option value="">—</option>
          {churchOptions.map((church) => (
            <option key={church.value} value={church.value}>
              {church.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="reg-flock">Bergerie</label>
        <select
          id="reg-flock"
          value={state.data.flock}
          onChange={(event) => updateData({ flock: event.target.value })}
          disabled={!state.data.church || loadingFlocks}
        >
          <option value="">
            {state.data.church ? "—" : "Choisissez d'abord une église"}
          </option>
          {flockOptions.map((flock) => (
            <option key={flock.id} value={flock.id}>
              {flock.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default StepIdentity;
