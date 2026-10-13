import { motion } from "framer-motion";

import { Heart, UsersRound, Sprout, HandHeart } from "lucide-react";

import "./Values.scss";

// Les classes sont préfixées `home-values` : les anciens noms génériques
// (`.value-card`, `.icon`, `.line`) entraient en collision avec d'autres
// pages, la feuille de style étant unique (voir CLAUDE.md).
const values = [
  {
    id: "adorer",
    icon: Heart,
    title: "Adorer",
    text: "Nous élevons nos cœurs dans l'adoration sincère.",
  },
  {
    id: "appartenir",
    icon: UsersRound,
    title: "Appartenir",
    text: "Une famille soudée, unie en Christ.",
  },
  {
    id: "grandir",
    icon: Sprout,
    title: "Grandir",
    text: "Nous grandissons dans la Parole et la vérité.",
  },
  {
    id: "impacter",
    icon: HandHeart,
    title: "Impacter",
    text: "Nous sommes envoyés pour impacter le monde.",
  },
];

const Values = () => {
  return (
    <section
      className="home-values"
      aria-labelledby="home-values-title"
    >
      <div className="home-values__container">
        <header className="home-values__header">
          <span className="home-values__eyebrow">Notre identité</span>

          <h2 id="home-values-title">
            Quatre mots pour une vie de foi
          </h2>
        </header>

        <ol className="home-values__grid">
          {values.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.li
                key={item.id}
                className="home-values__card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
              >
                <span
                  className="home-values__number"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span
                  className="home-values__icon"
                  aria-hidden="true"
                >
                  <Icon strokeWidth={1.8} />
                </span>

                <h3>{item.title}</h3>

                <p>{item.text}</p>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};

export default Values;
