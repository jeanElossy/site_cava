import "./ImpactCard.scss";

import {
  FaHeart,
  FaCheckCircle,
} from "react-icons/fa";

import {
  useContribution,
} from "../../../context/useContribution";

const ImpactCard = () => {
  const { state } =
    useContribution();

  // La carte commente le TYPE DE DON réellement choisi dans le
  // tunnel. Elle s'appuyait sur `state.contributionType`, un champ
  // supprimé de l'état : le `switch` tombait donc toujours dans son
  // cas par défaut, quel que soit le choix du visiteur.
  //
  // Les types de don sont administrables : le rapprochement se fait
  // sur le NOM, normalisé (casse et espaces de bordure ignorés). Un
  // type ajouté par l'administration et inconnu d'ici retombe sur le
  // texte générique — qui reste juste, contrairement à un libellé
  // inventé.
  const getImpact = () => {
    const amount =
      Number(state.amount);

    const type = String(
      state.donationType?.name ?? ""
    )
      .trim()
      .toLowerCase();

    switch (type) {
      case "dîme":
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
      case "don libre":
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

      case "action de grâce":
      case "action de grace":
        return {
          title:
            "Action de grâce",
          items: [
            "Expression de reconnaissance",
            "Soutien à l'œuvre de Dieu",
            "Participation aux projets de l'église",
          ],
        };

      case "construction":
        return {
          title:
            "Impact sur la construction",
          items:
            amount >= 100000
              ? [
                  "Contribution majeure au chantier",
                  "Accélération de sa réalisation",
                  "Impact durable sur la communauté",
                ]
              : [
                  "Participation au financement du chantier",
                  "Soutien à l'avancement des travaux",
                  "Contribution à la vision de l'église",
                ],
        };

      case "mission":
        return {
          title:
            "Impact de votre don missionnaire",
          items:
            amount >= 100000
              ? [
                  "Soutien appuyé aux campagnes d'évangélisation",
                  "Envoi et accompagnement sur le terrain",
                  "Implantation durable au-delà d'Abidjan",
                ]
              : [
                  "Participation aux sorties d'évangélisation",
                  "Soutien aux équipes envoyées",
                  "Contribution à l'annonce de la Parole",
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