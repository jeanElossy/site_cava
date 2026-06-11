import "./TransparencySection.scss";

import {
  FaShieldAlt,
  FaChartPie,
  FaChurch,
  FaFileInvoiceDollar,
} from "react-icons/fa";

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
      "Les dons permettent de soutenir l'évangélisation, les œuvres sociales et les projets de l'église.",
  },
  {
    icon: <FaShieldAlt />,
    title: "Paiement sécurisé",
    description:
      "Toutes les transactions sont protégées par des systèmes de sécurité avancés.",
  },
];

const TransparencySection = () => {
  return (
    <section className="transparency-section">

      <div className="section-header">

        <h2>Transparence & Confiance</h2>

        <p>
          Nous nous engageons à utiliser chaque contribution
          avec intégrité et responsabilité.
        </p>

      </div>

      <div className="transparency-grid">

        {items.map((item, index) => (
          <article
            key={index}
            className="transparency-card"
          >
            <div className="transparency-icon">
              {item.icon}
            </div>

            <h3>{item.title}</h3>

            <p>{item.description}</p>
          </article>
        ))}

      </div>

      <div className="trust-banner">

        <div>
          <strong>100%</strong>
          <span>Traçabilité</span>
        </div>

        <div>
          <strong>24/7</strong>
          <span>Paiements sécurisés</span>
        </div>

        <div>
          <strong>+15</strong>
          <span>Projets soutenus</span>
        </div>

        <div>
          <strong>+2 000</strong>
          <span>Contributeurs</span>
        </div>

      </div>

    </section>
  );
};

export default TransparencySection;