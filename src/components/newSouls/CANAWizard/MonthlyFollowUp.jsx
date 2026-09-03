import "../shared/NewSouls.scss";
import { MONTHLY_PERIODS } from "./options";

const toInputDate = (value) => (value ? String(value).slice(0, 10) : "");

const emptyExtraRow = () => ({ period: "", objective: "", reviewDate: "", observedSituation: "", decision: "" });

// §O — Tableau des bilans mensuels. Les 4 mois standard sont
// toujours présents (avec leur objectif imposé par la fiche
// officielle) ; des lignes supplémentaires peuvent être ajoutées pour
// un accompagnement prolongé exceptionnellement (voir §P).
const MonthlyFollowUp = ({ rows = [], onChange, disabled }) => {
  const standardRows = MONTHLY_PERIODS.map((period) => {
    const existing = rows.find((row) => row.period === period.value);

    return existing ?? { period: period.value, objective: period.defaultObjective };
  });
  const extraRows = rows.filter(
    (row) => !MONTHLY_PERIODS.some((period) => period.value === row.period)
  );

  const allRows = [...standardRows, ...extraRows];

  const updateRow = (period, field, value) => {
    const next = allRows.map((row) => (row.period === period ? { ...row, [field]: value } : row));
    onChange(next);
  };

  const addExtraRow = () => onChange([...allRows, emptyExtraRow()]);
  const removeRow = (period) => onChange(allRows.filter((row) => row.period !== period));

  return (
    <div>
      <table className="new-soul-table">
        <thead>
          <tr>
            <th>Période</th>
            <th>Objectif</th>
            <th>Date du bilan</th>
            <th>Situation observée</th>
            <th>Décision</th>
            {!disabled && <th />}
          </tr>
        </thead>
        <tbody>
          {allRows.map((row, index) => {
            const isStandard = MONTHLY_PERIODS.some((period) => period.value === row.period);

            return (
              <tr key={row.period || `extra-${index}`}>
                {/* `data-label` : sous 760 px chaque ligne devient une
                    carte, cet intitulé remplaçant l'en-tête de colonne
                    (mixin `admin-stacked-table`). */}
                <td data-label="Période">
                  {isStandard ? (
                    MONTHLY_PERIODS.find((period) => period.value === row.period)?.label
                  ) : (
                    <input
                      type="text"
                      placeholder="Ex. Mois 5"
                      value={row.period ?? ""}
                      disabled={disabled}
                      onChange={(event) => updateRow(row.period, "period", event.target.value)}
                    />
                  )}
                </td>
                <td data-label="Objectif">
                  <input
                    type="text"
                    value={row.objective ?? ""}
                    disabled={disabled}
                    onChange={(event) => updateRow(row.period, "objective", event.target.value)}
                  />
                </td>
                <td data-label="Date du bilan">
                  <input
                    type="date"
                    value={toInputDate(row.reviewDate)}
                    disabled={disabled}
                    onChange={(event) =>
                      updateRow(
                        row.period,
                        "reviewDate",
                        event.target.value ? new Date(event.target.value).toISOString() : null
                      )
                    }
                  />
                </td>
                <td data-label="Situation observée">
                  <input
                    type="text"
                    value={row.observedSituation ?? ""}
                    disabled={disabled}
                    onChange={(event) => updateRow(row.period, "observedSituation", event.target.value)}
                  />
                </td>
                <td data-label="Décision">
                  <input
                    type="text"
                    value={row.decision ?? ""}
                    disabled={disabled}
                    onChange={(event) => updateRow(row.period, "decision", event.target.value)}
                  />
                </td>
                {!disabled && (
                  <td>
                    {!isStandard && (
                      <button
                        type="button"
                        className="new-soul-table__remove"
                        onClick={() => removeRow(row.period)}
                        aria-label="Supprimer ce suivi"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {!disabled && (
        <button
          type="button"
          className="admin-form__button admin-form__button--ghost"
          onClick={addExtraRow}
        >
          + Ajouter un suivi (accompagnement prolongé)
        </button>
      )}
    </div>
  );
};

export default MonthlyFollowUp;
