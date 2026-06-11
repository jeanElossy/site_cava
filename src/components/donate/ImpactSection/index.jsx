import "./ImpactCard.scss";

import {
  FaHeart,
  FaCheckCircle,
} from "react-icons/fa";

import {
  useContribution,
} from "../../../context/ContributionContext";

const ImpactCard = () => {
  const { state } =
    useContribution();

  const getImpact = () => {
    const amount =
      Number(state.amount);

    switch (
      state.contributionType
    ) {
      case "dime":
        return {
          title:
            "Impact de votre dîme",
          items:
            amount >= 50000
              ? [
                  "Soutien durable des activités de l'église",
                  "Participation à l'œuvre missionnaire",
                  "Accompagnement spirituel des fidèles",
                ]
              : [
                  "Soutien au fonctionnement de l'église",
                  "Participation aux activités pastorales",
                  "Contribution à la mission de l'église",
                ],
        };

      case "offrande":
        return {
          title:
            "Impact de votre offrande",
          items:
            amount >= 50000
              ? [
                  "Soutien à des actions spéciales",
                  "Contribution aux événements de l'église",
                  "Participation aux projets communautaires",
                ]
              : [
                  "Soutien aux cultes",
                  "Participation à la vie de l'église",
                  "Encouragement des œuvres locales",
                ],
        };

      case "grace":
        return {
          title:
            "Action de grâce",
          items: [
            "Expression de reconnaissance",
            "Soutien à l'œuvre de Dieu",
            "Participation aux projets de l'église",
          ],
        };

      case "projet":
        return {
          title:
            "Impact du projet",
          items:
            amount >= 100000
              ? [
                  "Contribution majeure au projet",
                  "Accélération de sa réalisation",
                  "Impact durable sur la communauté",
                ]
              : [
                  "Participation au financement",
                  "Soutien à l'avancement du projet",
                  "Contribution à la vision de l'église",
                ],
        };

      default:
        return {
          title:
            "Impact de votre contribution",
          items:
            amount >= 50000
              ? [
                  "Soutien important à l'œuvre",
                  "Participation aux projets de croissance",
                  "Impact durable sur la communauté",
                ]
              : [
                  "Soutien à l'œuvre de Dieu",
                  "Participation à l'évangélisation",
                  "Contribution aux besoins de l'église",
                ],
        };
    }
  };

  const impact =
    getImpact();

  return (
    <div className="impact-card">

      <div className="impact-card__badge">
        ✨ Impact
      </div>

      <div className="impact-card__header">

        <FaHeart />

        <h4>
          {impact.title}
        </h4>

      </div>

      <ul>
        {impact.items.map(
          (item, index) => (
            <li key={index}>
              <FaCheckCircle />
              <span>{item}</span>
            </li>
          )
        )}
      </ul>

    </div>
  );
};

export default ImpactCard;