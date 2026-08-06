// src/components/donate/ContributionForm/data.js
//
// Types de don et moyens de paiement viennent désormais de l'API
// (voir services/donations.js) — ce fichier ne porte plus que les
// montants suggérés, les libellés d'étapes et la validation.

export const amounts = [5000, 10000, 20000, 50000, 100000];

// Chaque étape correspond à une étape réelle de la démarche du
// donateur (identité → moyen → paiement → preuve), pas à une
// numérotation arbitraire — voir la section « Design visuel » de la
// spec.
export const steps = [
  "Vos informations",
  "Moyen de paiement",
  "Paiement",
  "Preuve",
];

export const validateStep = (step, state) => {
  if (step === 0) {
    if (!state.donor.firstName.trim()) {
      return "Merci d'indiquer votre prénom.";
    }

    if (!state.donor.lastName.trim()) {
      return "Merci d'indiquer votre nom.";
    }

    if (!state.donor.phone.trim()) {
      return "Merci d'indiquer un numéro de téléphone.";
    }

    if (!state.donationType.id) {
      return "Merci de choisir un type de don.";
    }

    if (!state.amount || state.amount <= 0) {
      return "Merci d'indiquer un montant supérieur à zéro.";
    }
  }

  if (step === 1 && !state.paymentMethod.id) {
    return "Merci de choisir un moyen de paiement.";
  }

  if (step === 3) {
    if (!state.proof.transactionId.trim()) {
      return "Merci de saisir le numéro de transaction reçu par SMS après votre paiement.";
    }
  }

  return "";
};
