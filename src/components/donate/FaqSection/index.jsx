import { useId, useState } from "react";

import { FaChevronDown } from "react-icons/fa";

import "./FaqSection.scss";

// Questions fréquentes.
//
// ------------------------------------------------------------------
// CES RÉPONSES DÉCRIVENT LE PARCOURS RÉEL, PAS L'ANCIEN
// ------------------------------------------------------------------
// Elles décrivaient encore le guichet de paiement en ligne qui a été
// retiré : « prestataire agréé », cartes Visa et Mastercard, reçu
// disponible « dès la confirmation du paiement », case « contribution
// anonyme », don depuis l'étranger par carte. Plus rien de tout cela
// n'existe.
//
// Le parcours d'aujourd'hui : le donateur règle LUI-MÊME, dans son
// application Mobile Money, sur le QR code (ou le numéro) de
// l'église, puis déclare ici le numéro de transaction reçu par SMS.
// Un administrateur le rapproche du relevé Mobile Money réel avant de
// valider. Le reçu n'existe qu'après cette validation.
//
// Une FAQ qui promet un reçu immédiat ou l'anonymat produit des
// appels à l'église et des donateurs déçus : chaque réponse ci-dessous
// doit rester vérifiable en donnant.
const faqs = [
  {
    question: "Comment se passe un don, concrètement ?",
    answer:
      "En quatre étapes. Vous indiquez vos coordonnées, le type de don et le montant ; vous choisissez l'opérateur Mobile Money de l'église ; vous réglez depuis votre propre application Mobile Money, en scannant le QR code affiché ou en composant le numéro indiqué ; vous revenez saisir le numéro de transaction reçu par SMS. Votre don est alors enregistré, en attente de vérification.",
  },
  {
    question: "Mes contributions sont-elles sécurisées ?",
    answer:
      "Le paiement a lieu entièrement dans votre application Mobile Money, entre votre opérateur et le compte de l'église : aucun code secret, aucune coordonnée bancaire ne transite par ce site, qui n'en demande d'ailleurs aucun. Nous n'enregistrons que vos coordonnées, le montant déclaré et le numéro de transaction.",
  },
  {
    question: "Quels moyens de paiement puis-je utiliser ?",
    answer:
      "Les comptes Mobile Money de l'église : Orange Money, MTN Money, Moov Money et Wave, selon ceux qui sont actifs au moment de votre don. Il n'y a pas de paiement par carte bancaire. Les contributions sont réglées en francs CFA.",
  },
  {
    question: "Pourquoi dois-je saisir un numéro de transaction ?",
    answer:
      "Parce que le paiement se fait en dehors du site : rien ici ne peut constater qu'il a eu lieu. Le numéro de transaction, reçu par SMS et propre à votre opération, est ce qui permet à un responsable de la retrouver sur le relevé Mobile Money de l'église. Vous pouvez y joindre une capture d'écran de la confirmation, mais elle ne remplace pas le numéro.",
  },
  {
    question: "Quand mon don est-il confirmé ?",
    answer:
      "Après vérification manuelle. Votre don reste « en attente » le temps qu'un responsable rapproche votre numéro de transaction du relevé de l'église. Ce n'est donc pas instantané : comptez généralement quelques jours. Conservez la référence affichée à la fin du formulaire, elle identifie votre don.",
  },
  {
    question: "Recevrai-je un reçu ?",
    answer:
      "Oui, une fois votre don vérifié et validé. Le reçu au format PDF n'est délivré qu'à ce moment-là — pas dès l'envoi du formulaire —, car l'église ne peut attester que d'un versement qu'elle a réellement constaté sur son relevé.",
  },
  {
    question: "Puis-je contribuer de manière anonyme ?",
    answer:
      "Non. Prénom, nom et téléphone sont indispensables : sans eux, un responsable ne pourrait ni rapprocher votre déclaration du relevé, ni vous joindre si le numéro de transaction reste introuvable. Ces informations servent uniquement au suivi de votre don.",
  },
  {
    question: "Puis-je contribuer depuis l'étranger ?",
    answer:
      "Seulement si vous disposez d'un compte Mobile Money permettant d'envoyer de l'argent vers un compte ivoirien. Aucun paiement par carte bancaire n'est proposé. Depuis l'étranger, le plus simple reste de contacter directement l'église.",
  },
  {
    question: "Comment les fonds sont-ils utilisés ?",
    answer:
      "Vous choisissez l'affectation de votre contribution au moment du don, parmi les types proposés dans le formulaire : dîme, offrande, action de grâce, construction, mission ou don libre.",
  },
  {
    question: "Je me suis trompé de montant ou de numéro de transaction.",
    answer:
      "Contactez l'église sans attendre, avec la référence affichée à la fin du formulaire. Un don ne peut pas être modifié depuis le site : un responsable le rejettera, avec une remarque explicative, et vous pourrez le déclarer à nouveau correctement.",
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
