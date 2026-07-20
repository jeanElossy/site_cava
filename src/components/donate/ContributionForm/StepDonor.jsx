// Étape 2 : coordonnées du donateur.
const fields = [
  {
    key: "firstName",
    label: "Prénom",
    autoComplete: "given-name",
    type: "text",
  },
  {
    key: "lastName",
    label: "Nom",
    autoComplete: "family-name",
    type: "text",
  },
  {
    key: "phone",
    label: "Téléphone",
    autoComplete: "tel",
    type: "tel",
  },
  {
    key: "email",
    label: "Email",
    autoComplete: "email",
    type: "email",
  },
];

const StepDonor = ({ state, updateDonor }) => (
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
            onChange={(e) =>
              updateDonor(field.key, e.target.value)
            }
          />
        ))}

      </div>

      <label className="checkbox">

        <input
          type="checkbox"
          checked={state.donor.anonymous}
          onChange={(e) =>
            updateDonor("anonymous", e.target.checked)
          }
        />

        Contribution anonyme

      </label>

    </div>

  </div>
);

export default StepDonor;
