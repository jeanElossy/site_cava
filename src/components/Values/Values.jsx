import {
  Heart,
  UsersRound,
  Sprout,
  HandHeart
} from "lucide-react";

import "./Values.scss";

const values = [
  {
    icon: <Heart strokeWidth={1.8} />,
    title: "ADORER",
    text: "Nous élevons nos cœurs dans l'adoration sincère.",
    color: "green"
  },
  {
    icon: <UsersRound strokeWidth={1.8} />,
    title: "APPARTENIR",
    text: "Une famille soudée, unie en Christ.",
    color: "yellow"
  },
  {
    icon: <Sprout strokeWidth={1.8} />,
    title: "GRANDIR",
    text: "Nous grandissons dans la parole et la vérité.",
    color: "green"
  },
  {
    icon: <HandHeart strokeWidth={1.8} />,
    title: "IMPACTER",
    text: "Nous sommes envoyés pour impacter le monde.",
    color: "yellow"
  }
];

const Values = () => {
  return (
    <section className="values">
      <div className="container">
        {values.map((item, index) => (
          <div className="value-card" key={index}>
            <div className={`icon ${item.color}`}>
              {item.icon}
            </div>

            <h3>{item.title}</h3>

            <p>{item.text}</p>

            <div className={`line ${item.color}`}></div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Values;