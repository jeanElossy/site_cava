import { Link } from "react-router-dom";

import { FaArrowRight, FaChurch } from "react-icons/fa";

import "./CommunityJoin.scss";

import joinImage from "../../../assets/images/ministry-cta.jpg";

const steps = [
  {
    id: "venir",
    number: "01",
    title: "Venez un dimanche",
    text: "Aucun rendez-vous à prendre. Présentez-vous à l'accueil : quelqu'un vous accompagnera.",
  },
  {
    id: "rencontrer",
    number: "02",
    title: "Rencontrons-nous",
    text: "Un temps d'échange avec un responsable pour comprendre vos attentes et répondre à vos questions.",
  },
  {
    id: "rejoindre",
    number: "03",
    title: "Rejoignez un groupe",
    text: "Nous vous orientons vers le groupe de maison le plus proche de chez vous.",
  },
];

const CommunityJoin = () => {
  return (
    <section
      className="community-join"
      style={{
        backgroundImage: `url(${joinImage})`,
      }}
    >
      <div
        className="community-join__overlay"
        aria-hidden="true"
      ></div>

      <div className="community-join__container">
        <div className="community-join__intro">
          <FaChurch
            className="community-join__icon"
            aria-hidden="true"
          />

          <h2>Vous cherchez une famille&nbsp;?</h2>

          <p>
            Il n&apos;y a pas de parcours type ni de profil attendu. Venez
            comme vous êtes : la communauté fera le reste du chemin avec
            vous.
          </p>

          <div className="community-join__actions">
            <Link
              to="/contact"
              className="community-join__cta"
            >
              Nous contacter
              <FaArrowRight aria-hidden="true" />
            </Link>

            <Link
              to="/events"
              className="community-join__cta community-join__cta--ghost"
            >
              Voir les prochains rendez-vous
            </Link>
          </div>
        </div>

        <ol className="community-join__steps">
          {steps.map((step) => (
            <li key={step.id}>
              <span
                className="community-join__step-number"
                aria-hidden="true"
              >
                {step.number}
              </span>

              <div>
                <h3>{step.title}</h3>

                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default CommunityJoin;
