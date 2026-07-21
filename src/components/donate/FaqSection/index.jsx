import { useId, useState } from "react";

import { FaChevronDown } from "react-icons/fa";

import "./FaqSection.scss";

// Questions fréquentes.
//
// Les réponses ont été reprises pour décrire ce que le site fait
// RÉELLEMENT depuis la mise en place du paiement. Deux d'entre elles
// promettaient autre chose :
//
//   - « une confirmation est envoyée » laissait entendre un e-mail.
//     Aucun envoi n'existe : la confirmation s'affiche à l'écran et le
//     reçu se télécharge. Un donateur qui attend un courriel qui ne
//     viendra jamais finit par appeler l'église, persuadé que son
//     paiement a échoué.
//   - « dans plusieurs devises » était faux : les paiements sont
//     encaissés en francs CFA.
const faqs = [
  {
    question: "Mes contributions sont-elles sécurisées ?",
    answer:
      "Oui. Le paiement se déroule entièrement sur la plateforme de notre prestataire agréé : vos coordonnées bancaires ou de mobile money ne transitent jamais par notre site et n'y sont jamais enregistrées.",
  },
  {
    question: "Quels moyens de paiement puis-je utiliser ?",
    answer:
      "Orange Money, MTN Money, Moov Money, Wave, ainsi que les cartes Visa et Mastercard. Les contributions sont encaissées en francs CFA.",
  },
  {
    question: "Recevrai-je un reçu ?",
    answer:
      "Oui. Dès la confirmation du paiement, un reçu au format PDF est disponible : vous pouvez le télécharger ou le partager directement. Il porte un QR code permettant d'en vérifier l'authenticité à tout moment.",
  },
  {
    question: "Puis-je contribuer de manière anonyme ?",
    answer:
      "Oui, en cochant « contribution anonyme ». Aucune donnée personnelle n'est alors enregistrée. À noter : le paiement par carte reste indissociable de votre nom, exigé par le prestataire ; pour donner sans laisser d'identité, choisissez le mobile money.",
  },
  {
    question: "Puis-je contribuer depuis l'étranger ?",
    answer:
      "Oui, par carte bancaire. Les paiements par mobile money nécessitent en revanche un compte auprès d'un opérateur ivoirien.",
  },
  {
    question: "Comment les fonds sont-ils utilisés ?",
    answer:
      "Vous choisissez l'affectation de votre contribution au moment du don : œuvre générale, évangélisation, action sociale, formation biblique, média ou construction.",
  },
];

const FaqSection = () => {
  // `useId` plutôt qu'un index : deux listes de questions sur une même
  // page produiraient sinon des identifiants en double, et `aria-controls`
  // pointerait vers le mauvais panneau.
  const baseId = useId();

  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="faq-section">
      <div className="faq-section__container">

        <header className="faq-section__header">
          <span className="donate-eyebrow">Vos questions</span>

          <h2>Questions fréquentes</h2>

          <p>
            Tout ce qu&apos;il faut savoir avant de contribuer.
          </p>
        </header>

        <div className="faq-section__list">
          {faqs.map((faq, index) => {
            const open = openIndex === index;

            const questionId = `${baseId}-q${index}`;
            const answerId = `${baseId}-a${index}`;

            return (
              <div
                key={faq.question}
                className={
                  open
                    ? "faq-section__item faq-section__item--open"
                    : "faq-section__item"
                }
              >
                <h3 className="faq-section__heading">
                  <button
                    type="button"
                    id={questionId}
                    className="faq-section__question"
                    aria-expanded={open}
                    aria-controls={answerId}
                    onClick={() => setOpenIndex(open ? null : index)}
                  >
                    <span>{faq.question}</span>

                    <FaChevronDown
                      className="faq-section__chevron"
                      aria-hidden="true"
                    />
                  </button>
                </h3>

                {/* Le panneau reste dans le document, replié par une
                    hauteur nulle : c'est ce qui permet la transition.
                    `hidden` le retirerait d'un coup, sans animation. */}
                <div
                  id={answerId}
                  role="region"
                  aria-labelledby={questionId}
                  className="faq-section__answer"
                >
                  <p>{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default FaqSection;
