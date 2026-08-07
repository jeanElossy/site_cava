import {
  FaShieldAlt,
  FaChartPie,
  FaChurch,
  FaFileInvoiceDollar,
  FaMobileAlt,
  FaSearch,
  FaBullseye,
  FaReceipt,
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
    title: "Paiement chez votre opérateur",
    description:
      "Vous réglez depuis votre propre application Mobile Money, vers le compte de l'église.",
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
//
// Deux d'entre elles ont dû être réécrites avec le retrait du guichet
// de paiement en ligne. « Reçu immédiat » et « Anonymat possible »
// étaient devenues fausses : le reçu n'existe qu'après vérification
// manuelle, et le don exige désormais une identité pour pouvoir être
// rapproché du relevé Mobile Money de l'église. Une promesse fausse
// sur une page de don coûte plus cher qu'une promesse absente.
const guarantees = [
  {
    icon: <FaMobileAlt />,
    title: "Paiement chez vous",
    text: "Rien à saisir ici : vous payez dans votre application Mobile Money.",
  },
  {
    icon: <FaSearch />,
    title: "Vérification humaine",
    text: "Chaque don est rapproché du relevé de l'église avant d'être validé.",
  },
  {
    icon: <FaBullseye />,
    title: "Affectation au choix",
    text: "Vous décidez du type de don auquel votre contribution est destinée.",
  },
  {
    icon: <FaReceipt />,
    title: "Reçu après validation",
    text: "Une fois votre don vérifié, un reçu vérifiable vous est délivré.",
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
