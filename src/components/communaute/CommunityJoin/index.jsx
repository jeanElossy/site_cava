import { Link } from "react-router-dom";

import { motion } from "framer-motion";

import { FaArrowRight } from "react-icons/fa";

import "./CommunityJoin.scss";

import joinImage from "../../../assets/images/ministry-cta.jpg";

const steps = [
  {
    id: "venir",
    title: "Venez un dimanche",
    text: "Aucun rendez-vous à prendre. Présentez-vous à l'accueil : quelqu'un vous accompagnera.",
  },
  {
    id: "rencontrer",
    title: "Rencontrons-nous",
    text: "Un temps d'échange avec un responsable pour comprendre vos attentes et répondre à vos questions.",
  },
  {
    id: "rejoindre",
    title: "Rejoignez un groupe",
    text: "Nous vous orientons vers le groupe de maison le plus proche de chez vous.",
  },
];

const CommunityJoin = () => {
  return (
    <section
      className="community-join"
      aria-labelledby="community-join-title"
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
          <span className="community-join__eyebrow">
            Nous rejoindre
          </span>

          <h2 id="community-join-title">
            Vous cherchez une famille&nbsp;?
          </h2>

          <p>
            Il n&apos;y a pas de parcours type ni de profil attendu. Venez
            comme vous êtes : la communauté fera le reste du chemin avec
            vous.
          </p>

          <div className="community-join__actions">
            <Link
              to="/inscription"
              className="community-join__cta"
            >
              Devenir membre
              <FaArrowRight aria-hidden="true" />
            </Link>

            <Link
              to="/contact"
              className="community-join__cta community-join__cta--ghost"
            >
              Nous contacter
            </Link>
          </div>

          <p className="community-join__more">
            Envie de servir&nbsp;?{" "}
            <Link to="/appel-a-candidature">
              Consultez l&apos;appel à candidatures
            </Link>
            {" "}ou{" "}
            <Link to="/events">les prochains rendez-vous</Link>.
          </p>
        </div>

        <ol className="community-join__steps">
          {steps.map((step, index) => (
            <motion.li
              key={step.id}
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.45, delay: index * 0.1 }}
            >
              <span
                className="community-join__step-number"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>

              <div>
                <h3>{step.title}</h3>

                <p>{step.text}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default CommunityJoin;
