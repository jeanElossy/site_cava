// Données et libellés du tunnel d'inscription.
//
// Extraits du composant pour qu'il ne porte que l'orchestration —
// même découpage que ContributionForm/data.js côté page Don.

import { normalizeRegistrationNumber } from "../../../utils/registrationNumber";

// Les 5 églises du réseau ne changent pratiquement jamais : liste
// codée en dur, comme MEMBER_ROLES dans CommunityAdmin.jsx. À adapter
// ici si les noms réels des églises diffèrent de ces libellés
// génériques.
export const CHURCHES = [
  { value: 1, label: "Église 1" },
  { value: 2, label: "Église 2" },
  { value: 3, label: "Église 3" },
  { value: 4, label: "Église 4" },
  { value: 5, label: "Église 5" },
];

export const churchLabel = (value) =>
  CHURCHES.find((church) => church.value === Number(value))?.label ??
  `Église ${value}`;

export const GENDERS = [
  { value: "homme", label: "Homme" },
  { value: "femme", label: "Femme" },
];

export const MARITAL_STATUSES = [
  { value: "celibataire", label: "Célibataire" },
  { value: "marie", label: "Marié(e)" },
  { value: "veuf", label: "Veuf / veuve" },
  { value: "divorce", label: "Divorcé(e)" },
];

export const steps = [
  "Matricule",
  "Identité",
  "Contact",
  "État civil",
  "Vie spirituelle",
  "Engagement",
  "Récapitulatif",
];

export const validateStep = (step, state) => {
  if (
    step === 0 &&
    state.kind === "update" &&
    !state.submittedRegistrationNumber.trim()
  ) {
    return "Merci de saisir votre matricule.";
  }

  if (step === 1) {
    if (!state.data.firstName.trim()) {
      return "Merci d'indiquer votre prénom.";
    }

    if (!state.data.lastName.trim()) {
      return "Merci d'indiquer votre nom.";
    }

    if (!state.data.church) {
      return "Merci de choisir votre église.";
    }

    if (!state.data.flock) {
      return "Merci de choisir votre bergerie.";
    }
  }

  if (step === 2 && !state.data.phone.trim()) {
    return "Merci d'indiquer un numéro de téléphone.";
  }

  return "";
};

export const buildSubmissionPayload = (state) => ({
  type: state.kind,
  registrationNumber:
    state.kind === "update"
      ? normalizeRegistrationNumber(state.submittedRegistrationNumber)
      : undefined,
  data: {
    firstName: state.data.firstName.trim(),
    lastName: state.data.lastName.trim(),
    church: Number(state.data.church),
    flock: state.data.flock,
    phone: state.data.phone.trim(),
    whatsapp: state.data.whatsapp.trim(),
    email: state.data.email.trim(),
    address: state.data.address.trim(),
    emergencyContact: {
      name: state.data.emergencyContactName.trim(),
      phone: state.data.emergencyContactPhone.trim(),
    },
    dateOfBirth: state.data.dateOfBirth || undefined,
    gender: state.data.gender || undefined,
    maritalStatus: state.data.maritalStatus || undefined,
    childrenCount:
      state.data.childrenCount !== ""
        ? Number(state.data.childrenCount)
        : undefined,
    conversionYear:
      state.data.conversionYear !== ""
        ? Number(state.data.conversionYear)
        : undefined,
    baptism: {
      water: state.data.baptismWater,
      waterYear:
        state.data.baptismWaterYear !== ""
          ? Number(state.data.baptismWaterYear)
          : undefined,
      holySpirit: state.data.baptismHolySpirit,
    },
    previousChurch: state.data.previousChurch.trim(),
    profession: state.data.profession.trim(),
    skills: state.data.skills
      ? state.data.skills
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    desiredDepartment: state.data.desiredDepartment.trim(),
    availability: state.data.availability.trim(),
  },
});
