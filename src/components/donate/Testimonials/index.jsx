import "./Testimonials.scss";

import {
  FaQuoteLeft,
  FaStar,
} from "react-icons/fa";

const testimonials = [
  {
    name: "Marie Kouassi",
    role: "Membre de l'église",
    text:
      "Grâce aux actions soutenues par les contributions, ma famille a reçu un accompagnement précieux dans une période difficile.",
  },
  {
    name: "Jean-Baptiste Yao",
    role: "Responsable jeunesse",
    text:
      "Les dons permettent d'organiser des activités qui transforment réellement la vie des jeunes de notre communauté.",
  },
  {
    name: "Esther N'Dri",
    role: "Participante",
    text:
      "J'ai vu l'impact concret des projets financés par l'église. Chaque contribution fait une différence.",
  },
];

const Testimonials = () => {
  return (
    <section className="testimonials">

      <div className="testimonials__container">

        <div className="section-header">

          <span className="section-badge">
            ❤️ Témoignages
          </span>

          <h2>
            Ils témoignent de l'impact
          </h2>

          <p>
            Découvrez comment les contributions
            permettent de transformer des vies et
            de soutenir la mission de l'église.
          </p>

        </div>

        <div className="testimonials__grid">

          {testimonials.map(
            (testimonial, index) => (
              <article
                key={index}
                className="testimonial-card"
              >
                <FaQuoteLeft className="quote-icon" />

                <p>
                  {testimonial.text}
                </p>

                <div className="testimonial-rating">
                  {[...Array(5)].map(
                    (_, i) => (
                      <FaStar key={i} />
                    )
                  )}
                </div>

                <div className="testimonial-author">

                  <div className="avatar">
                    {testimonial.name.charAt(0)}
                  </div>

                  <div>
                    <h4>
                      {testimonial.name}
                    </h4>

                    <span>
                      {testimonial.role}
                    </span>
                  </div>

                </div>

              </article>
            )
          )}

        </div>

      </div>
    </section>
  );
};

export default Testimonials;