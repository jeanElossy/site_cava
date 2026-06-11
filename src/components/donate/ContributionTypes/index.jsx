import "./ContributionTypes.scss";

import {
  FaChurch,
  FaHandHoldingHeart,
  FaHeart,
  FaPrayingHands,
  FaTools,
} from "react-icons/fa";

import {
  useContribution,
} from "../../../context/ContributionContext";

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
  const { state, dispatch } =
    useContribution();

  const handleSelectType = (typeId) => {
    dispatch({
      type: "SET_TYPE",
      payload: typeId,
    });
  };

  return (
    <section className="contribution-types">
      <div className="section-header">
        <h2>
          Choisissez votre contribution
        </h2>

        <p>
          Sélectionnez le type de contribution
          que vous souhaitez effectuer.
        </p>
      </div>

      <div className="types-grid">

        {contributionTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            className={`type-card ${
              state.contributionType === type.id
                ? "active"
                : ""
            }`}
            onClick={() =>
              handleSelectType(type.id)
            }
          >
            <div className="type-icon">
              {type.icon}
            </div>

            <h3>{type.title}</h3>

            <p>{type.description}</p>
          </button>
        ))}

      </div>
    </section>
  );
};

export default ContributionTypes;