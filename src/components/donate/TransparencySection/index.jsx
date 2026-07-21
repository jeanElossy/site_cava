import {
  FaShieldAlt,
  FaChartPie,
  FaChurch,
  FaFileInvoiceDollar,
  FaLock,
  FaReceipt,
  FaBullseye,
  FaUserSecret,
} from "react-icons/fa";

import "./TransparencySection.scss";

const items = [
  {
    icon: <FaChartPie />,
    title: "Gestion transparente",
    description:
      "Chaque contribution est affectée à des projets clairement identifiés et suivis.",
  },
  {
    icon: <FaFileInvoiceDollar />,
    title: "Rapports réguliers",
    description:
      "Des rapports financiers sont publiés afin d'assurer une parfaite visibilité.",
  },
  {
    icon: <FaChurch />,
    title: "Impact réel",
    description:
      "Les dons soutiennent l'évangélisation, les œuvres sociales et les projets de l'église.",
  },
  {
    icon: <FaShieldAlt />,
    title: "Paiement sécurisé",
    description:
      "Les paiements sont traités par un prestataire agréé, sur sa propre plateforme.",
  },
];

// Bandeau de garanties.
//
// ------------------------------------------------------------------
// POURQUOI CE NE SONT PLUS DES CHIFFRES
// ------------------------------------------------------------------
// Ce bandeau affichait « +15 projets soutenus » et « +2 000
// contributeurs ». Deux valeurs inventées — et qui contredisaient
// celles de la section chiffrée de la même page, laquelle annonçait
// 12 projets et 1 284 contributeurs. Deux nombres différents pour la
// même réalité, à deux écrans d'intervalle.
//
// Ils sont remplacés par quatre garanties VÉRIFIABLES, qui décrivent
// exactement ce que fait le système de don : chacune est vraie, et
// chacune se constate en donnant.
const guarantees = [
  {
    icon: <FaLock />,
    title: "Paiement hébergé",
    text: "Vos coordonnées bancaires ne transitent jamais par notre site.",
  },
  {
    icon: <FaReceipt />,
    title: "Reçu immédiat",
    text: "Un reçu vérifiable est disponible dès la confirmation du paiement.",
  },
  {
    icon: <FaBullseye />,
    title: "Affectation au choix",
    text: "Vous décidez du projet auquel votre contribution est destinée.",
  },
  {
    icon: <FaUserSecret />,
    title: "Anonymat possible",
    text: "Vous pouvez donner sans laisser aucune donnée personnelle.",
  },
];

const TransparencySection = () => {
  return (
    <section className="transparency-section">
      <div className="transparency-section__container">

        <header className="transparency-section__header">
          <span className="donate-eyebrow">Notre engagement</span>

          <h2>Transparence et confiance</h2>

          <p>
            Nous nous engageons à utiliser chaque contribution avec
            intégrité et responsabilité.
          </p>
        </header>

        <div className="transparency-section__grid">
          {items.map((item) => (
            <article
              key={item.title}
              className="transparency-section__card"
            >
              <span
                className="transparency-section__icon"
                aria-hidden="true"
              >
                {item.icon}
              </span>

              <h3>{item.title}</h3>

              <p>{item.description}</p>
            </article>
          ))}
        </div>

        <ul className="transparency-section__banner">
          {guarantees.map((item) => (
            <li key={item.title}>
              <span
                className="transparency-section__banner-icon"
                aria-hidden="true"
              >
                {item.icon}
              </span>

              <strong>{item.title}</strong>

              <span className="transparency-section__banner-text">
                {item.text}
              </span>
            </li>
          ))}
        </ul>

      </div>
    </section>
  );
};

export default TransparencySection;
