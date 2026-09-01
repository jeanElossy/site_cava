import { colorFor } from "./palette";

import "./ChildrenChart.scss";

// Barres de progression horizontales — « présents / inscrits, par classe ».
//
// Barres et non anneau : on compare ici des MAGNITUDES entre classes,
// et l'œil compare des longueurs alignées bien mieux que des angles.
//
// Chaque barre porte sa valeur en clair à droite : la longueur donne
// l'ordre de grandeur, le chiffre donne la valeur exacte, et la couleur
// ne fait que rappeler de quelle classe il s'agit.
const ChildrenBars = ({ title, rows, emptyLabel = "Aucune donnée." }) => (
  <figure className="children-chart">
    <figcaption className="children-chart__title">{title}</figcaption>

    {rows.length === 0 ? (
      <p className="children-chart__empty">{emptyLabel}</p>
    ) : (
      <ul className="children-chart__bars">
        {rows.map((row, index) => {
          const percent =
            row.total > 0 ? Math.round((row.value / row.total) * 100) : 0;

          return (
            <li key={row.key}>
              <div className="children-chart__bar-head">
                <span className="children-chart__bar-label">{row.label}</span>

                <span className="children-chart__bar-value">
                  {row.value} / {row.total}
                  <em>{percent} %</em>
                </span>
              </div>

              <div
                className="children-chart__bar-track"
                role="img"
                aria-label={`${row.label} : ${row.value} sur ${row.total}, soit ${percent} %`}
              >
                <span
                  className="children-chart__bar-fill"
                  style={{
                    width: `${percent}%`,
                    background: colorFor(row.colorIndex ?? index),
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </figure>
);

export default ChildrenBars;
