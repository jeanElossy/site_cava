import { motion } from "framer-motion";

import { FaStar } from "react-icons/fa";

import "./MinistryTestimonials.scss";

const MinistryTestimonials = ({ testimonials = [] }) => {
  if (testimonials.length === 0) {
    return null;
  }

  return (
    <section
      className="ministry-testimonials"
      aria-labelledby="ministry-testimonials-title"
    >
      <div className="ministry-testimonials__container">
        <header className="ministry-testimonials__header">
          <span className="ministry-testimonials__eyebrow">
            Ils en parlent
          </span>

          <h2 id="ministry-testimonials-title">Témoignages</h2>
        </header>

        <div className="ministry-testimonials__grid">
          {testimonials.map((testimonial, index) => {
            const rating = testimonial.rating || 5;

            return (
              <motion.figure
                key={testimonial.author}
                className="ministry-testimonials__card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                <div
                  className="ministry-testimonials__rating"
                  role="img"
                  aria-label={`Note : ${rating} sur 5`}
                >
                  {Array.from({ length: rating }, (_, star) => (
                    <FaStar key={star} aria-hidden="true" />
                  ))}
                </div>

                <blockquote className="ministry-testimonials__quote">
                  {/* Le modèle nomme le texte `quote` ; `message` était le
                      nom de l'ancien contenu en dur. Lire seulement
                      `message` affichait des guillemets vides. */}
                  <p>« {testimonial.quote ?? testimonial.message} »</p>
                </blockquote>

                <figcaption className="ministry-testimonials__author">
                  — {testimonial.author}
                </figcaption>
              </motion.figure>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MinistryTestimonials;
