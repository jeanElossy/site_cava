import { motion } from "framer-motion";

import ecoleImage from "../../assets/images/pillars/ecole.jpg";
import armeeImage from "../../assets/images/pillars/armee.jpg";
import familleImage from "../../assets/images/pillars/famille.jpg";
import entrepriseImage from "../../assets/images/pillars/entreprise.jpg";

import "./AboutPillars.scss";

// Les quatre piliers fournis par l'église (13/10/2026). Les photos sont
// des recadrages portrait (720 × 900) d'images déjà présentes sur le
// site, importées depuis `src/assets` et non référencées dans `public/` :
// Vite vérifie ainsi leur présence au build, et elles restent servies
// par le site lui-même (aucun domaine tiers à ouvrir dans la CSP).
const pillars = [
  {
    id: "ecole",
    title: "L'École",
    image: ecoleImage,
    alt: "Un groupe d'étude biblique autour d'une Bible ouverte",
    verbs: ["Former", "Enseigner", "Transformer"],
  },
  {
    id: "armee",
    title: "L'Armée",
    image: armeeImage,
    alt: "Un prédicateur qui harangue l'assemblée, micro en main",
    verbs: ["Mobiliser", "Discipliner", "Envoyer"],
  },
  {
    id: "famille",
    title: "La Famille",
    image: familleImage,
    alt: "Des membres réunis dans un salon, Bible en main",
    verbs: ["Aimer", "Soutenir", "Restaurer"],
  },
  {
    id: "entreprise",
    title: "L'Entreprise",
    image: entrepriseImage,
    alt: "Des mains réunies au centre d'un cercle, en signe d'unité",
    verbs: ["Gérer", "Structurer", "Développer"],
  },
];

const AboutPillars = () => {
  return (
    <section
      className="about-pillars"
      id="piliers"
      aria-labelledby="about-pillars-title"
    >
      <div className="about-pillars__container">
        <header className="about-pillars__header">
          <div>
            <span className="about-pillars__eyebrow">Ce qui nous porte</span>

            <h2 id="about-pillars-title">Nos piliers</h2>
          </div>

          <p>
            Quatre dimensions d&apos;une même Église, pour faire grandir
            chacun dans toutes les sphères de sa vie.
          </p>
        </header>

        <ol className="about-pillars__grid">
          {pillars.map((pillar, index) => (
            <motion.li
              key={pillar.id}
              className="about-pillars__card"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
            >
              <img
                className="about-pillars__image"
                src={pillar.image}
                alt={pillar.alt}
                width="720"
                height="900"
                loading="lazy"
                decoding="async"
              />

              <span
                className="about-pillars__number"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>

              <div className="about-pillars__body">
                <h3>{pillar.title}</h3>

                <ul
                  className="about-pillars__verbs"
                  aria-label={`${pillar.title} : nos missions`}
                >
                  {pillar.verbs.map((verb) => (
                    <li key={verb}>{verb}</li>
                  ))}
                </ul>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default AboutPillars;
