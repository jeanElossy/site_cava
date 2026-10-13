import { motion } from "framer-motion";

import {
  BookOpen,
  Compass,
  Flame,
  Globe2,
  HandHeart,
  Network,
} from "lucide-react";

import "./Values.scss";

// Les classes sont préfixées `home-values` : les anciens noms génériques
// (`.value-card`, `.icon`, `.line`) entraient en collision avec d'autres
// pages, la feuille de style étant unique (voir CLAUDE.md).
//
// Six traits fournis par l'église (13/10/2026), affichés en deux lignes
// de trois sur ordinateur.
const values = [
  {
    id: "apostolique",
    icon: Compass,
    title: "Apostolique",
    text: "Église apostolique dans sa vision.",
  },
  {
    id: "biblique",
    icon: BookOpen,
    title: "Biblique",
    text: "Église biblique dans son enseignement.",
  },
  {
    id: "spirituelle",
    icon: Flame,
    title: "Spirituelle",
    text: "Église spirituelle dans sa vie.",
  },
  {
    id: "missionnaire",
    icon: Globe2,
    title: "Missionnaire",
    text: "Église missionnaire dans ses actions.",
  },
  {
    id: "active",
    icon: HandHeart,
    title: "Active",
    text: "Église active dans la société.",
  },
  {
    id: "structuree",
    icon: Network,
    title: "Structurée",
    text: "Église structurée, organisée et capable de se multiplier.",
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
            Six traits qui nous définissent
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
