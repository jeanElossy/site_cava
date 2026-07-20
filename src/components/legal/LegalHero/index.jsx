import { motion } from "framer-motion";

import "./LegalHero.scss";

const LegalHero = ({ title, intro }) => {
  return (
    <section className="legal-hero">
      <div className="legal-hero__container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="legal-hero__title">{title}</h1>

          <div className="legal-hero__line" />

          <p className="legal-hero__intro">{intro}</p>
        </motion.div>
      </div>
    </section>
  );
};

export default LegalHero;
