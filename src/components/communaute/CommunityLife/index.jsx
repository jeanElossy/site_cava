import { motion } from "framer-motion";

import {
  FaHandsHelping,
  FaPrayingHands,
  FaSeedling,
  FaUsers,
} from "react-icons/fa";

import "./CommunityLife.scss";

import lifeImage from "../../../assets/images/family.jpg";

const pillars = [
  {
    id: "communion",
    icon: <FaUsers aria-hidden="true" />,
    title: "La communion fraternelle",
    text: "On ne vient pas seulement assister à un culte : on appartient à une famille qui connaît votre prénom, votre histoire et vos combats.",
  },
  {
    id: "priere",
    icon: <FaPrayingHands aria-hidden="true" />,
    title: "La prière partagée",
    text: "Chaque semaine, des frères et sœurs portent ensemble les sujets de la maison, du quartier et de l'église.",
  },
  {
    id: "croissance",
    icon: <FaSeedling aria-hidden="true" />,
    title: "La croissance spirituelle",
    text: "Étude de la Parole, discipulat et accompagnement personnel pour avancer pas à pas, à votre rythme.",
  },
  {
    id: "entraide",
    icon: <FaHandsHelping aria-hidden="true" />,
    title: "L'entraide concrète",
    text: "Un déménagement, une naissance, une épreuve : la communauté se mobilise au-delà des paroles.",
  },
];

const CommunityLife = () => {
  return (
    <section className="community-life">
      <div className="community-life__container">
        <div className="community-life__media">
          <img
            src={lifeImage}
            alt="Membres de la communauté CAVA réunis après le culte"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="community-life__body">
          <span className="community-life__eyebrow">
            La vie communautaire
          </span>

          <h2>Grandir ensemble, au quotidien</h2>

          <div
            className="community-life__line"
            aria-hidden="true"
          ></div>

          <p>
            Au Centre Apostolique Vie et Abondance, la communauté n&apos;est
            pas un supplément au dimanche : c&apos;est le lieu où la foi se
            vit en semaine. Elle se construit dans les groupes de maison, les
            temps de prière, les services rendus et les repas partagés.
          </p>

          <p>
            Quel que soit votre point de départ, il existe une place pour
            vous. Notre objectif est simple : que personne ne traverse seul
            ce qu&apos;il a à traverser.
          </p>

          <ul className="community-life__pillars">
            {pillars.map((pillar, index) => (
              <motion.li
                key={pillar.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{
                  duration: 0.45,
                  delay: index * 0.08,
                }}
              >
                <span className="community-life__pillar-icon">
                  {pillar.icon}
                </span>

                <div>
                  <h3>{pillar.title}</h3>

                  <p>{pillar.text}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default CommunityLife;
