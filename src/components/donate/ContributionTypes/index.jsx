import {
  FaCheck,
  FaChurch,
  FaHandHoldingHeart,
  FaHeart,
  FaPrayingHands,
  FaTools,
} from "react-icons/fa";

import { useContribution } from "../../../context/ContributionContext";

import "./ContributionTypes.scss";

const contributionTypes = [
  {
    id: "dime",
    title: "Dîme",
    description: "Exprimez votre fidélité",
    icon: <FaChurch />,
  },
  {
    id: "offrande",
    title: "Offrande",
    description: "Un acte d'adoration",
    icon: <FaPrayingHands />,
  },
  {
    id: "don",
    title: "Don",
    description: "Soutien libre",
    icon: <FaHeart />,
  },
  {
    id: "grace",
    title: "Action de grâce",
    description: "Remerciez Dieu",
    icon: <FaHandHoldingHeart />,
  },
  {
    id: "projet",
    title: "Projet spécial",
    description: "Construction & équipements",
    icon: <FaTools />,
  },
];

const ContributionTypes = () => {
  const { state, dispatch } = useContribution();

  return (
    <section className="contribution-types" id="types">
      <div className="contribution-types__container">

        <header className="contribution-types__header">
          <span className="donate-eyebrow">Première étape</span>

          <h2>Choisissez votre contribution</h2>

          <p>
            Chaque forme de contribution a son sens. Sélectionnez celle
            qui correspond à votre démarche.
          </p>
        </header>

        {/* `radiogroup` plutôt qu'une simple rangée de boutons : ces
            cartes forment un choix unique, et un lecteur d'écran doit
            l'annoncer comme tel — « 2 sur 5 », et non cinq boutons
            indépendants dont on ne saurait lequel est actif. */}
        <div
          className="contribution-types__grid"
          role="radiogroup"
          aria-label="Type de contribution"
        >
          {contributionTypes.map((type) => {
            const active = state.contributionType === type.id;

            return (
              <button
                key={type.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={
                  active
                    ? "contribution-types__card contribution-types__card--active"
                    : "contribution-types__card"
                }
                onClick={() =>
                  dispatch({ type: "SET_TYPE", payload: type.id })
                }
              >
                <span
                  className="contribution-types__check"
                  aria-hidden="true"
                >
                  <FaCheck />
                </span>

                <span
                  className="contribution-types__icon"
                  aria-hidden="true"
                >
                  {type.icon}
                </span>

                <span className="contribution-types__title">
                  {type.title}
                </span>

                <span className="contribution-types__desc">
                  {type.description}
                </span>
              </button>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default ContributionTypes;
