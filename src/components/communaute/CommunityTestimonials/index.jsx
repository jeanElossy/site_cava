import { motion } from "framer-motion";

import { FaQuoteLeft } from "react-icons/fa";

import "./CommunityTestimonials.scss";

import { communityTestimonials as testimonials } from "../../../content/testimonials";

// Témoignages de la vie communautaire.
//
// Ils étaient écrits en dur ici, signés « Aminata K. », « Serge A. » et
// « Grâce B. » — des personnes qui n'existent pas, racontant une perte
// d'emploi ou l'accueil reçu à leur arrivée. Des propos intimes prêtés
// à des inconnus.
//
// Ils sont désormais saisis depuis l'administration (rubrique
// Témoignages, emplacement « Page Communauté »), avec l'accord de la
// personne enregistré. La section se masque tant qu'aucun n'est publié.
const CommunityTestimonials = () => {
  if (testimonials.length === 0) return null;

  return (
    <section className="community-voices">
      <div className="community-voices__container">
        <header className="community-voices__header">
          <span className="community-voices__eyebrow">Témoignages</span>

          <h2>Ce que la communauté a changé</h2>

          <div
            className="community-voices__line"
            aria-hidden="true"
          ></div>
        </header>

        <ul className="community-voices__grid">
          {testimonials.map((item, index) => (
            <motion.li
              key={item.id}
              className="community-voices__card"
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.45,
                delay: index * 0.08,
              }}
            >
              <figure>
                <FaQuoteLeft
                  className="community-voices__quote-icon"
                  aria-hidden="true"
                />

                <blockquote>{item.quote}</blockquote>

                <figcaption>
                  <span className="community-voices__name">
                    {item.name}
                  </span>

                  <span className="community-voices__role">
                    {item.role}
                  </span>
                </figcaption>
              </figure>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default CommunityTestimonials;
