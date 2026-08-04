// Données et libellés du tunnel d'inscription.
//
// Extraits du composant pour qu'il ne porte que l'orchestration —
// même découpage que ContributionForm/data.js côté page Don.

import { normalizeRegistrationNumber } from "../../../utils/registrationNumber";

// Les églises sont désormais gérées depuis l'administration (ressource
// `churches`, voir services/api.js) : il n'y a plus de liste codée en
// dur ici. Les écrans qui en ont besoin chargent la liste via l'API
// (`churches.list()` côté public, `churches.listAdmin()` côté admin)
// et résolvent le libellé à partir du résultat — voir le commentaire
// dans RegistrationForm/index.jsx pour l'endroit où ce chargement se
// fait pour le tunnel d'inscription.
export const churchLabelFrom = (churchOptions, value) =>
  churchOptions.find((church) => Number(church.value) === Number(value))
    ?.label ?? `Église ${value}`;

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

// Titre et phrase d'explication affichés en tête de chaque étape —
// c'est ce texte qui manquait pour que le formulaire s'explique
// lui-même plutôt que d'enchaîner des champs sans contexte.
export const stepMeta = [
  {
    title: "Votre situation",
    description:
      "Dites-nous si c'est votre première inscription à CAVA, ou si vous possédez déjà un matricule à mettre à jour.",
  },
  {
    title: "Votre identité",
    description:
      "Votre nom et la bergerie à laquelle vous appartenez, ou souhaitez appartenir.",
  },
  {
    title: "Comment vous joindre",
    description:
      "Téléphone, e-mail et une personne à prévenir en cas d'urgence.",
  },
  {
    title: "État civil",
    description: "Quelques informations personnelles, pour mieux vous connaître.",
  },
  {
    title: "Votre vie spirituelle",
    description: "Votre parcours de foi jusqu'à aujourd'hui.",
  },
  {
    title: "Votre engagement",
    description: "Vos talents et vos disponibilités, si vous souhaitez servir.",
  },
  {
    title: "Récapitulatif",
    description:
      "Vérifiez vos informations : une équipe les examine avant tout enregistrement définitif.",
  },
];

// Tous les champs sont obligatoires, à deux exceptions volontaires :
// - `photo` : personne ne peut être obligé d'en avoir une sous la
//   main au moment de s'inscrire (voir PhotoField).
// - `previousChurch` : n'a de sens que pour un membre qui vient
//   effectivement d'une autre église — le laisser vide est une
//   réponse complète, pas un oubli.
// Les cases à cocher (baptêmes) ne sont pas rendues "obligatoires" au
// sens classique : ne pas cocher est déjà une réponse valide (tout le
// monde n'est pas encore baptisé). `baptismWaterYear` ne devient
// obligatoire QUE si `baptismWater` est cochée.
export const validateStep = (step, state) => {
  if (step === 0 && state.kind === "update") {
    if (!state.submittedRegistrationNumber.trim()) {
      return "Merci de saisir votre matricule.";
    }

    if (!state.data.lastName.trim()) {
      return "Merci d'indiquer votre nom de famille, pour retrouver votre fiche.";
    }
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

  if (step === 2) {
    if (!state.data.phone.trim()) {
      return "Merci d'indiquer un numéro de téléphone.";
    }

    if (!state.data.whatsapp.trim()) {
      return "Merci d'indiquer un numéro WhatsApp.";
    }

    if (!state.data.email.trim()) {
      return "Merci d'indiquer une adresse e-mail.";
    }

    if (!state.data.address.trim()) {
      return "Merci d'indiquer votre adresse.";
    }

    if (!state.data.area.trim()) {
      return "Merci d'indiquer votre quartier ou groupe de maison.";
    }

    if (!state.data.emergencyContactName.trim()) {
      return "Merci d'indiquer le nom de la personne à prévenir en cas d'urgence.";
    }

    if (!state.data.emergencyContactPhone.trim()) {
      return "Merci d'indiquer le téléphone de la personne à prévenir en cas d'urgence.";
    }
  }

  if (step === 3) {
    if (!state.data.dateOfBirth) {
      return "Merci d'indiquer votre date de naissance.";
    }

    if (!state.data.gender) {
      return "Merci d'indiquer votre genre.";
    }

    if (!state.data.maritalStatus) {
      return "Merci d'indiquer votre situation matrimoniale.";
    }

    if (state.data.childrenCount === "") {
      return "Merci d'indiquer votre nombre d'enfants (0 si aucun).";
    }
  }

  if (step === 4) {
    if (state.data.arrivalYear === "") {
      return "Merci d'indiquer votre année d'arrivée à CAVA.";
    }

    if (state.data.conversionYear === "") {
      return "Merci d'indiquer votre année de conversion.";
    }

    if (state.data.baptismWater && state.data.baptismWaterYear === "") {
      return "Merci d'indiquer l'année de votre baptême d'eau.";
    }
  }

  if (step === 5) {
    if (!state.data.profession.trim()) {
      return "Merci d'indiquer votre profession.";
    }

    if (!state.data.skills.trim()) {
      return "Merci d'indiquer au moins une compétence.";
    }

    if (!state.data.desiredDepartment.trim()) {
      return "Merci d'indiquer le département où vous souhaitez servir.";
    }

    if (!state.data.availability.trim()) {
      return "Merci d'indiquer vos disponibilités.";
    }
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
    photo: state.data.photo || undefined,
    church: Number(state.data.church),
    flock: state.data.flock,
    phone: state.data.phone.trim(),
    whatsapp: state.data.whatsapp.trim(),
    email: state.data.email.trim(),
    address: state.data.address.trim(),
    area: state.data.area.trim(),
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
    arrivalYear:
      state.data.arrivalYear !== ""
        ? Number(state.data.arrivalYear)
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

// `<input type="date">` n'accepte que le format AAAA-MM-JJ — une date
// ISO complète le laisserait vide.
const toDateInputValue = (value) =>
  typeof value === "string" ? value.slice(0, 10) : "";

// Transforme la fiche renvoyée par memberSubmissions.lookup() (forme
// imbriquée du modèle Member) vers la forme À PLAT attendue par
// `state.data` — l'inverse de ce que fait buildSubmissionPayload.
//
// Seuls les champs présents dans `member` sont renvoyés : un champ
// jamais renseigné reste absent, et `updateData` (un simple merge)
// laisse alors la valeur vide déjà en place plutôt que de l'écraser.
export const memberToFormData = (member = {}) => {
  const patch = {};

  if (member.firstName !== undefined) patch.firstName = member.firstName;
  if (member.lastName !== undefined) patch.lastName = member.lastName;
  if (member.photo !== undefined) patch.photo = member.photo;
  if (member.church !== undefined) patch.church = String(member.church);
  if (member.flock !== undefined) patch.flock = member.flock;
  if (member.phone !== undefined) patch.phone = member.phone;
  if (member.whatsapp !== undefined) patch.whatsapp = member.whatsapp;
  if (member.email !== undefined) patch.email = member.email;
  if (member.address !== undefined) patch.address = member.address;
  if (member.area !== undefined) patch.area = member.area;

  // `Member` ne porte que `joinedAt` (une date) ; le formulaire ne
  // redemande que l'année, comme `conversionYear`.
  if (member.joinedAt !== undefined) {
    patch.arrivalYear = String(new Date(member.joinedAt).getFullYear());
  }

  if (member.emergencyContact) {
    if (member.emergencyContact.name !== undefined) {
      patch.emergencyContactName = member.emergencyContact.name;
    }

    if (member.emergencyContact.phone !== undefined) {
      patch.emergencyContactPhone = member.emergencyContact.phone;
    }
  }

  if (member.dateOfBirth !== undefined) {
    patch.dateOfBirth = toDateInputValue(member.dateOfBirth);
  }

  if (member.gender !== undefined) patch.gender = member.gender;
  if (member.maritalStatus !== undefined) {
    patch.maritalStatus = member.maritalStatus;
  }

  if (member.childrenCount !== undefined) {
    patch.childrenCount = String(member.childrenCount);
  }

  if (member.conversionYear !== undefined) {
    patch.conversionYear = String(member.conversionYear);
  }

  if (member.baptism) {
    if (member.baptism.water !== undefined) {
      patch.baptismWater = Boolean(member.baptism.water);
    }

    if (member.baptism.waterYear !== undefined) {
      patch.baptismWaterYear = String(member.baptism.waterYear);
    }

    if (member.baptism.holySpirit !== undefined) {
      patch.baptismHolySpirit = Boolean(member.baptism.holySpirit);
    }
  }

  if (member.previousChurch !== undefined) {
    patch.previousChurch = member.previousChurch;
  }

  if (member.profession !== undefined) patch.profession = member.profession;

  if (Array.isArray(member.skills)) {
    patch.skills = member.skills.join(", ");
  }

  if (member.desiredDepartment !== undefined) {
    patch.desiredDepartment = member.desiredDepartment;
  }

  if (member.availability !== undefined) {
    patch.availability = member.availability;
  }

  return patch;
};
