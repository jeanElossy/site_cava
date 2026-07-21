import { FaDonate, FaHandsHelping, FaChurch } from "react-icons/fa";

import { donationStats } from "../../../content/donations";

import "./ContributionStats.scss";

// Chiffres de la collecte.
//
// Les valeurs viennent des dons réellement encaissés (voir
// `content/donations.js`). La section entière disparaît tant que la
// collecte n'a pas de quoi être présentée honnêtement.

// Les grands nombres se lisent mal en francs CFA : 18 500 000 devient
// « 18,5 M ». En dessous du million, l'écriture complète reste plus
// parlante.
const compact = (value) => {
  if (value >= 1000000) {
    const millions = value / 1000000;

    return `${millions.toFixed(millions >= 10 ? 0 : 1).replace(".", ",")} M`;
  }

  return value.toLocaleString("fr-FR");
};

const ContributionStats = () => {
  if (!donationStats.visible) return null;

  const cards = [
    {
      key: "collected",
      icon: <FaDonate />,
      value: compact(donationStats.collected),
      label: "FCFA collectés",
    },
    {
      key: "contributions",
      icon: <FaHandsHelping />,
      value: donationStats.contributions.toLocaleString("fr-FR"),
      label: "Contributions reçues",
    },
    {
      key: "projects",
      icon: <FaChurch />,
      value: donationStats.projects.toLocaleString("fr-FR"),
      label: "Projets soutenus",
    },
  ];

  return (
    <section className="contribution-stats">
      <div className="contribution-stats__container">
        <ul className="contribution-stats__grid">
          {cards.map((card) => (
            <li key={card.key} className="contribution-stats__card">
              <span
                className="contribution-stats__icon"
                aria-hidden="true"
              >
                {card.icon}
              </span>

              <strong className="contribution-stats__value">
                {card.value}
              </strong>

              <span className="contribution-stats__label">
                {card.label}
              </span>
            </li>
          ))}
        </ul>

        <p className="contribution-stats__note">
          Chiffres issus des contributions effectivement encaissées,
          mis à jour à chaque publication du site.
        </p>
      </div>
    </section>
  );
};

export default ContributionStats;
