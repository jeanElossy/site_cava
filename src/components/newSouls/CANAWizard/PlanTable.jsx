import "../shared/NewSouls.scss";

const emptyRow = () => ({ need: "", action: "", owner: "", date: "", result: "" });

const toInputDate = (value) => (value ? String(value).slice(0, 10) : "");

// §M — Plan coordonné d'accompagnement. Tableau dynamique (Besoin /
// Action / Structure ou responsable / Date prévue / Résultat), lignes
// ajoutables librement.
const PlanTable = ({ rows = [], onChange, disabled }) => {
  const updateRow = (index, field, value) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    onChange(next);
  };

  const addRow = () => onChange([...rows, emptyRow()]);
  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div>
      <table className="new-soul-table">
        <thead>
          <tr>
            <th>Besoin identifié</th>
            <th>Action décidée</th>
            <th>Structure ou responsable</th>
            <th>Date prévue</th>
            <th>Résultat</th>
            {!disabled && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              <td>
                <input
                  type="text"
                  value={row.need ?? ""}
                  disabled={disabled}
                  onChange={(event) => updateRow(index, "need", event.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={row.action ?? ""}
                  disabled={disabled}
                  onChange={(event) => updateRow(index, "action", event.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={row.owner ?? ""}
                  disabled={disabled}
                  onChange={(event) => updateRow(index, "owner", event.target.value)}
                />
              </td>
              <td>
                <input
                  type="date"
                  value={toInputDate(row.date)}
                  disabled={disabled}
                  onChange={(event) =>
                    updateRow(
                      index,
                      "date",
                      event.target.value ? new Date(event.target.value).toISOString() : null
                    )
                  }
                />
              </td>
              <td>
                <input
                  type="text"
                  value={row.result ?? ""}
                  disabled={disabled}
                  onChange={(event) => updateRow(index, "result", event.target.value)}
                />
              </td>
              {!disabled && (
                <td>
                  <button
                    type="button"
                    className="new-soul-table__remove"
                    onClick={() => removeRow(index)}
                    aria-label="Supprimer cette ligne"
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {!disabled && (
        <button type="button" className="admin-form__button admin-form__button--ghost" onClick={addRow}>
          + Ajouter une ligne
        </button>
      )}
    </div>
  );
};

export default PlanTable;
