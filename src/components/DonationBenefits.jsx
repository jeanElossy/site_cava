import "./DonationBenefits.scss";

import {
  FaFileInvoice,
  FaShieldAlt,
  FaHandsHelping,
  FaHeart,
} from "react-icons/fa";

const benefits = [
  {
    icon: <FaFileInvoice />,
    title: "Reçu de don",
    description:
      "Recevez un reçu pour tout don effectué.",
  },
  {
    icon: <FaShieldAlt />,
    title: "Transparence",
    description:
      "Nous vous informons régulièrement de l'utilisation des dons.",
  },
  {
    icon: <FaHandsHelping />,
    title: "Déductible d'impôt",
    description:
      "Vos dons peuvent être déductibles d'impôts selon la loi en vigueur.",
  },
  {
    icon: <FaHeart />,
    title: "Merci pour votre soutien",
    description:
      "Dieu vous bénisse abondamment pour votre générosité !",
  },
];

const DonationBenefits = () => {
  return (
    <section className="donation-benefits">
      <div className="donation-benefits__container">

        {benefits.map((item, index) => (
          <div
            key={index}
            className="benefit-card"
          >
            <div className="benefit-card__icon">
              {item.icon}
            </div>

            <div className="benefit-card__content">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </div>
        ))}

      </div>
    </section>
  );
};

export default DonationBenefits;