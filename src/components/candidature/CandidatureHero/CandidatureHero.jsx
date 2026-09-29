import { motion, useReducedMotion } from "framer-motion";

import heroImage from "../../../assets/images/candidature-hero.webp";

import "./CandidatureHero.scss";

// Le hero s'anime À L'ARRIVÉE (`animate`), pas au défilement : il est
// déjà à l'écran au chargement, un `whileInView` s'y déclencherait au
// même instant tout en laissant le risque d'un texte invisible si
// l'observateur ne se déclenche pas.
const CandidatureHero = () => {
  const reduced = useReducedMotion();

  const enter = (delay) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
        };

  return (
    <section className="candidature-hero">
      {/* La photo est portée par un élément à part, pas par le fond de
          la section : c'est ce qui permet de l'animer (lent zoom
          arrière) sans emmener le texte avec elle. */}
      <motion.div
        className="candidature-hero__media"
        style={{ backgroundImage: `url(${heroImage})` }}
        aria-hidden="true"
        initial={reduced ? false : { scale: 1.12 }}
        animate={reduced ? false : { scale: 1 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      />

      <div className="candidature-hero__overlay" aria-hidden="true" />

      <div className="candidature-hero__container">
        <div className="candidature-hero__content">
          <motion.h1 className="candidature-hero__title" {...enter(0.05)}>
            Appel à <span>candidatures</span>
          </motion.h1>

          <motion.p
            className="candidature-hero__baseline"
            {...enter(0.18)}
          >
            ÇA.VA. se structure.
            <br />
            Et si vous preniez votre place
          </motion.p>

          <motion.p className="candidature-hero__claim" {...enter(0.26)}>
            pour <span>servir ?</span>
          </motion.p>

          <motion.div
            className="candidature-hero__rule"
            aria-hidden="true"
            initial={reduced ? false : { scaleX: 0 }}
            animate={reduced ? false : { scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.36, ease: [0.22, 1, 0.36, 1] }}
          />

          <motion.p className="candidature-hero__intro" {...enter(0.44)}>
            Dans le cadre de la constitution et du renforcement de ses
            structures, ÇA.VA. recherche des hommes et des femmes disposés
            à mettre leurs dons, leurs compétences et leur disponibilité au
            service de la vision.
          </motion.p>
        </div>

        <motion.p
          className="candidature-hero__badge"
          initial={reduced ? false : { opacity: 0, scale: 0.85, rotate: -10 }}
          animate={reduced ? false : { opacity: 1, scale: 1, rotate: -4 }}
          transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          Des serviteurs pour une Église qui impacte !
        </motion.p>

        {/* Décoratif : les quatre mots d'ambiance de la maquette.
            `aria-hidden` parce qu'ils n'apportent rien à qui écoute la
            page — le sens est déjà porté par le paragraphe ci-dessus. */}
        <ul className="candidature-hero__keywords" aria-hidden="true">
          {["Vision", "Service", "Unité", "Impact"].map((word, index) => (
            <motion.li key={word} {...enter(0.7 + index * 0.08)}>
              {word}
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default CandidatureHero;
