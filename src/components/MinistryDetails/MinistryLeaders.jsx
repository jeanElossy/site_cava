import { motion } from "framer-motion";

import "./MinistryLeaders.scss";

/**
 * Retourne les initiales d'un nom, en ignorant les titres (Fr., Sr., Pasteur).
 * Le site ne dispose pas de portraits : on affiche un médaillon d'initiales
 * plutôt qu'une image cassée ou une photo d'illustration trompeuse.
 */
const getInitials = (name = "") =>
  name
    .replace(/^(Fr\.|Sr\.|Pasteur|Past\.)\s*/i, "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const MinistryLeaders = ({ leaders = [] }) => {
  if (leaders.length === 0) {
    return null;
  }

  return (
    <section
      className="ministry-leaders"
      aria-labelledby="ministry-leaders-title"
    >
      <div className="ministry-leaders__container">
        <header className="ministry-leaders__header">
          <span className="ministry-leaders__eyebrow">L&apos;équipe</span>

          <h2 id="ministry-leaders-title">Nos responsables</h2>
        </header>

        <ul className="ministry-leaders__grid">
          {leaders.map((leader, index) => {
            // Le modèle nomme la présentation `bio` ; `description` était
            // le nom de l'ancien contenu en dur. Ne lire que `description`
            // masquait toutes les présentations.
            const bio = leader.bio ?? leader.description;

            return (
              <motion.li
                key={leader.name}
                className="ministry-leaders__card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                {leader.image ? (
                  <img
                    className="ministry-leaders__avatar"
                    src={leader.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span
                    className="ministry-leaders__avatar ministry-leaders__avatar--initials"
                    aria-hidden="true"
                  >
                    {getInitials(leader.name)}
                  </span>
                )}

                <div className="ministry-leaders__body">
                  <h3>{leader.name}</h3>

                  {leader.role && (
                    <span className="ministry-leaders__role">
                      {leader.role}
                    </span>
                  )}

                  {bio && <p>{bio}</p>}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default MinistryLeaders;
