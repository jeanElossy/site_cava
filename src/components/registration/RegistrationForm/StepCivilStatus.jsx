import { GENDERS, MARITAL_STATUSES } from "./data";

const StepCivilStatus = ({ state, updateData }) => (
  <div className="step-panel">
    <div className="form-group">
      <label htmlFor="reg-dob">Date de naissance</label>
      <input
        id="reg-dob"
        type="date"
        value={state.data.dateOfBirth}
        onChange={(event) => updateData({ dateOfBirth: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-gender">Genre</label>
      <select
        id="reg-gender"
        value={state.data.gender}
        onChange={(event) => updateData({ gender: event.target.value })}
      >
        <option value="">—</option>
        {GENDERS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>

    <div className="form-group">
      <label htmlFor="reg-marital">Situation matrimoniale</label>
      <select
        id="reg-marital"
        value={state.data.maritalStatus}
        onChange={(event) =>
          updateData({ maritalStatus: event.target.value })
        }
      >
        <option value="">—</option>
        {MARITAL_STATUSES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>

    <div className="form-group">
      <label htmlFor="reg-children">Nombre d&apos;enfants</label>
      <input
        id="reg-children"
        type="number"
        min="0"
        max="30"
        value={state.data.childrenCount}
        onChange={(event) =>
          updateData({ childrenCount: event.target.value })
        }
      />
    </div>
  </div>
);

export default StepCivilStatus;
