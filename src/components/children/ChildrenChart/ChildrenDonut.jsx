import { useId, useState } from "react";

import { colorFor } from "./palette";

import "./ChildrenChart.scss";

// Anneau de répartition — « 96 enfants, répartis par classe ».
//
// DONUT et non camembert : le trou central porte le total, qui est
// l'information la plus consultée de la carte. Réservé aux répartitions
// de 5 catégories au plus ; au-delà, des barres se comparent mieux.
//
// Un écart de 2 px sépare les segments (`--gap` ci-dessous) : sans lui,
// deux segments voisins de teintes proches se lisent comme un seul.
const RADIUS = 54;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2;

const ChildrenDonut = ({ title, total, totalLabel = "Total", slices }) => {
  const titleId = useId();
  const [hovered, setHovered] = useState(null);

  const sum = slices.reduce((acc, slice) => acc + slice.value, 0);

  // Un total nul n'est pas une erreur : c'est une École du dimanche qui
  // n'a pas encore d'enfants. On affiche l'anneau vide plutôt qu'un
  // graphique cassé ou un espace blanc inexpliqué.
  let offset = 0;

  return (
    <figure className="children-chart">
      <figcaption
        className="children-chart__title"
        id={titleId}
      >
        {title}
      </figcaption>

      <div className="children-chart__donut-layout">
        <div className="children-chart__donut">
          <svg
            viewBox="0 0 140 140"
            role="img"
            aria-labelledby={titleId}
          >
            <circle
              cx="70"
              cy="70"
              r={RADIUS}
              fill="none"
              className="children-chart__track"
              strokeWidth={STROKE}
            />

            {sum > 0 &&
              slices.map((slice, index) => {
                const fraction = slice.value / sum;
                const length = Math.max(0, fraction * CIRCUMFERENCE - GAP);
                const dash = `${length} ${CIRCUMFERENCE - length}`;
                const rotation = (offset / CIRCUMFERENCE) * 360 - 90;

                offset += fraction * CIRCUMFERENCE;

                return (
                  <circle
                    key={slice.key}
                    cx="70"
                    cy="70"
                    r={RADIUS}
                    fill="none"
                    stroke={colorFor(slice.colorIndex ?? index)}
                    strokeWidth={STROKE}
                    strokeDasharray={dash}
                    strokeLinecap="butt"
                    transform={`rotate(${rotation} 70 70)`}
                    opacity={hovered && hovered !== slice.key ? 0.35 : 1}
                    onMouseEnter={() => setHovered(slice.key)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <title>
                      {slice.label} : {slice.value} (
                      {Math.round(fraction * 100)} %)
                    </title>
                  </circle>
                );
              })}
          </svg>

          <div className="children-chart__center">
            <strong>{total ?? sum}</strong>

            <span>{totalLabel}</span>
          </div>
        </div>

        {/* Légende TOUJOURS présente : l'identité ne repose jamais sur
            la seule couleur. Elle porte aussi la valeur et le
            pourcentage, ce qui la rend lisible sans le graphique — et
            tient lieu de vue tabulaire. */}
        <ul className="children-chart__legend">
          {slices.map((slice, index) => (
            <li
              key={slice.key}
              onMouseEnter={() => setHovered(slice.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                className="children-chart__swatch"
                style={{ background: colorFor(slice.colorIndex ?? index) }}
                aria-hidden="true"
              />

              <span className="children-chart__legend-label">{slice.label}</span>

              <span className="children-chart__legend-value">
                {slice.value}

                {sum > 0 && (
                  <em>({Math.round((slice.value / sum) * 100)} %)</em>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
};

export default ChildrenDonut;
