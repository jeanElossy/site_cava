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
          <h2 id="ministry-leaders-title">Nos Responsables</h2>

          <div className="ministry-leaders__line" />
        </header>

        <div className="ministry-leaders__grid">
          {leaders.map((leader, index) => (
            <motion.article
              key={leader.name}
              className="leader-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              {leader.image ? (
                <img
                  className="leader-card__avatar"
                  src={leader.image}
                  alt={leader.name}
                  loading="lazy"
                />
              ) : (
                <div
                  className="leader-card__avatar leader-card__avatar--initials"
                  aria-hidden="true"
                >
                  {getInitials(leader.name)}
                </div>
              )}

              <div className="leader-card__body">
                <h3>{leader.name}</h3>

                <span className="leader-card__role">{leader.role}</span>

                {leader.description && <p>{leader.description}</p>}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MinistryLeaders;
