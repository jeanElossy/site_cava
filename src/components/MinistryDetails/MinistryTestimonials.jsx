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
          <h2 id="ministry-testimonials-title">Témoignages</h2>

          <div className="ministry-testimonials__line" />
        </header>

        <div className="ministry-testimonials__grid">
          {testimonials.map((testimonial, index) => {
            const rating = testimonial.rating || 5;

            return (
              <motion.figure
                key={testimonial.author}
                className="testimonial-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                <div
                  className="testimonial-card__rating"
                  role="img"
                  aria-label={`Note : ${rating} sur 5`}
                >
                  {Array.from({ length: rating }, (_, star) => (
                    <FaStar key={star} aria-hidden="true" />
                  ))}
                </div>

                <blockquote className="testimonial-card__quote">
                  <p>« {testimonial.message} »</p>
                </blockquote>

                <figcaption className="testimonial-card__author">
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
