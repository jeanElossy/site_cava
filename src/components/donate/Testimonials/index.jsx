import { FaQuoteLeft } from "react-icons/fa";

import { donTestimonials as testimonials } from "../../../content/testimonials";

import "./Testimonials.scss";

// Témoignages de donateurs.
//
// Saisis depuis l'administration (rubrique Témoignages, emplacement
// « Page Don ») et récupérés au moment du build. La section disparaît
// tant qu'aucun n'est publié : une page de don sans témoignage vaut
// mieux qu'une page de don avec des témoignages inventés.
//
// Les étoiles ont été retirées : noter une église sur cinq étoiles,
// comme un restaurant, n'a pas de sens, et elles étaient de toute
// façon codées à cinq sur cinq quel que soit le témoignage.
const Testimonials = () => {
  if (testimonials.length === 0) return null;

  return (
    <section className="donate-testimonials">
      <div className="donate-testimonials__container">

        <header className="donate-testimonials__header">
          <span className="donate-eyebrow">Témoignages</span>

          <h2>Ils témoignent de l&apos;impact</h2>

          <p>
            Comment les contributions transforment des vies et
            soutiennent la mission de l&apos;église.
          </p>
        </header>

        <div className="donate-testimonials__grid">
          {testimonials.map((testimonial) => (
            <article
              key={testimonial.id}
              className="donate-testimonials__card"
            >
              <FaQuoteLeft
                className="donate-testimonials__quote"
                aria-hidden="true"
              />

              <blockquote>{testimonial.quote}</blockquote>

              <footer className="donate-testimonials__author">
                <span
                  className="donate-testimonials__avatar"
                  aria-hidden="true"
                >
                  {testimonial.name.charAt(0)}
                </span>

                <span>
                  <strong>{testimonial.name}</strong>

                  <span className="donate-testimonials__role">
                    {testimonial.role}
                  </span>
                </span>
              </footer>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Testimonials;
