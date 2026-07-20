// Données et libellés du tunnel de contribution.
//
// Extraits du composant pour qu'il ne porte plus que l'orchestration.
// Quand le backend existera, `projects` et `paymentMethods` viendront
// probablement de l'API : ce fichier sera alors le seul à changer.

import OrangeMoneyLogo from "../../../assets/images/orange-money.png";
import MTNMoneyLogo from "../../../assets/images/mtn-money.jpg";
import MoovMoneyLogo from "../../../assets/images/moov-money.png";
import WaveLogo from "../../../assets/images/wave.jpg";
import VisaMastercardLogo from "../../../assets/images/visa.png";

export const amounts = [
  5000,
  10000,
  20000,
  50000,
  100000,
];

export const projects = [
  {
    value: "general",
    label: "🏠 Œuvre Générale",
  },
  {
    value: "evangelisation",
    label: "🌍 Évangélisation",
  },
  {
    value: "social",
    label: "🤝 Action Sociale",
  },
  {
    value: "formation",
    label: "📖 Formation Biblique",
  },
  {
    value: "media",
    label: "🎤 Média & Streaming",
  },
  {
    value: "construction",
    label: "🏗 Construction",
  },
];

export const paymentMethods = [
  {
    value: "orange",
    label: "Orange Money",
    logo: OrangeMoneyLogo,
  },
  {
    value: "mtn",
    label: "MTN Money",
    logo: MTNMoneyLogo,
  },
  {
    value: "moov",
    label: "Moov Money",
    logo: MoovMoneyLogo,
  },
  {
    value: "wave",
    label: "Wave",
    logo: WaveLogo,
  },
  {
    value: "card",
    label: "Visa / Mastercard",
    logo: VisaMastercardLogo,
  },
];

// Le parcours est découpé en 3 étapes plutôt qu'un formulaire d'un seul
// tenant : chaque étape reste courte sur mobile, et l'intégration future
// d'un prestataire de paiement se branche naturellement sur la dernière.
export const steps = [
  "Montant",
  "Informations",
  "Paiement",
];

// Le contexte ne stocke que l'identifiant du type ("grace", "dime"…).
// Le résumé doit afficher le libellé lisible, pas l'identifiant brut.
const contributionTypeLabels = {
  dime: "Dîme",
  offrande: "Offrande",
  don: "Don",
  grace: "Action de grâce",
  projet: "Projet spécial",
};

export const contributionTypeLabel = (value) =>
  contributionTypeLabels[value] ?? value;

export const projectLabel = (value) =>
  projects.find((p) => p.value === value)?.label ??
  value;

export const paymentLabel = (value) =>
  paymentMethods.find((p) => p.value === value)
    ?.label ?? value;

// Validation par étape. Isolée ici pour être lisible et, plus tard,
// testable sans monter le composant.
export const validateStep = (step, state) => {
  if (step === 0) {
    if (!state.amount || state.amount <= 0) {
      return "Merci d'indiquer un montant supérieur à zéro.";
    }
  }

  if (step === 1 && !state.donor.anonymous) {
    if (!state.donor.firstName.trim()) {
      return "Merci d'indiquer votre prénom, ou de cocher « Contribution anonyme ».";
    }

    if (!state.donor.phone.trim()) {
      return "Merci d'indiquer un téléphone pour confirmer votre contribution.";
    }
  }

  return "";
};
