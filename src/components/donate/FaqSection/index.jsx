import "./FaqSection.scss";

import { useState } from "react";

import {
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";

const faqs = [
  {
    question:
      "Mes contributions sont-elles sécurisées ?",
    answer:
      "Oui. Toutes les transactions sont protégées et traitées via des systèmes de paiement sécurisés afin de garantir la confidentialité de vos informations.",
  },
  {
    question:
      "Puis-je contribuer depuis l'étranger ?",
    answer:
      "Oui. Les contributions peuvent être effectuées depuis différents pays et dans plusieurs devises selon les moyens de paiement disponibles.",
  },
  {
    question:
      "Comment les fonds sont-ils utilisés ?",
    answer:
      "Les contributions soutiennent les activités de l'église, les projets communautaires, les actions missionnaires et les initiatives sociales.",
  },
  {
    question:
      "Puis-je contribuer de manière anonyme ?",
    answer:
      "Oui. Vous pouvez choisir de ne pas afficher votre identité lors de votre contribution.",
  },
  {
    question:
      "Recevrai-je une confirmation après ma contribution ?",
    answer:
      "Oui. Une confirmation est envoyée dès que votre contribution est validée avec succès.",
  },
];

const FaqSection = () => {
  const [openIndex, setOpenIndex] =
    useState(0);

  const toggleFaq = (index) => {
    setOpenIndex(
      openIndex === index
        ? null
        : index
    );
  };

  return (
    <section className="faq-section">

      <div className="faq-section__container">

        <div className="section-header">

          <span className="section-badge">
            ❓ FAQ
          </span>

          <h2>
            Questions fréquentes
          </h2>

          <p>
            Retrouvez les réponses aux questions
            les plus courantes concernant les
            contributions et les dons.
          </p>

        </div>

        <div className="faq-list">

          {faqs.map(
            (faq, index) => (
              <div
                key={index}
                className={`faq-item ${
                  openIndex === index
                    ? "active"
                    : ""
                }`}
              >
                <button
                  className="faq-question"
                  onClick={() =>
                    toggleFaq(index)
                  }
                >
                  <span>
                    {faq.question}
                  </span>

                  {openIndex === index ? (
                    <FaChevronUp />
                  ) : (
                    <FaChevronDown />
                  )}
                </button>

                <div className="faq-answer">
                  <p>
                    {faq.answer}
                  </p>
                </div>
              </div>
            )
          )}

        </div>

      </div>
    </section>
  );
};

export default FaqSection;