import { motion } from "framer-motion";

import { FaQuoteLeft } from "react-icons/fa";

import "./CommunityTestimonials.scss";

const testimonials = [
  {
    id: "aminata",
    quote:
      "Je suis arrivée un dimanche sans connaître personne. Trois semaines plus tard, j'étais accueillie chaque mardi dans un groupe de maison. Aujourd'hui, ces personnes sont ma famille.",
    name: "Aminata K.",
    role: "Membre depuis 2022",
  },
  {
    id: "serge",
    quote:
      "Quand j'ai perdu mon emploi, la communauté ne s'est pas contentée de prier. On m'a aidé à refaire mon CV, on m'a ouvert des portes. La foi s'est traduite en actes.",
    name: "Serge A.",
    role: "Groupe de maison Yopougon",
  },
  {
    id: "grace",
    quote:
      "Mes enfants ont grandi ici. Ce qui me touche le plus, c'est de les voir servir à leur tour, avec la même joie que celle qu'on nous a transmise.",
    name: "Grâce B.",
    role: "Responsable d'accueil",
  },
];

const CommunityTestimonials = () => {
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
