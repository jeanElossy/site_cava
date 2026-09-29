// Quels champs de la fiche d'un membre sont restés vides ?
//
// Le formulaire public d'inscription (`/inscription`) demande bien plus
// que l'identité : état civil, vie spirituelle, engagement, contact
// étendu. Beaucoup de fiches, notamment celles reprises du registre
// papier (`seed-legacy-members.js`), ne portent que le strict minimum.
// Ce module dit, membre par membre, ce qu'il reste à demander — c'est
// la matière de la liste de relance.
//
// Logique PURE et sans base de données : elle se teste sans MongoDB, et
// les deux consommateurs (l'export PDF et, à terme, un écran
// d'administration) partagent exactement la même définition de
// « profil incomplet ». Une deuxième définition écrite ailleurs
// donnerait deux listes contradictoires pour la même base.

// Un texte saisi puis effacé peut rester en base sous forme de chaîne
// vide ou d'espaces : `trim()` avant de juger.
const hasText = (value) =>
  typeof value === "string" && value.trim() !== "";

const hasNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const hasDate = (value) =>
  value instanceof Date
    ? !Number.isNaN(value.getTime())
    : hasText(value);

// Ordre d'affichage = ordre des étapes du formulaire d'inscription :
// l'administrateur qui appelle un membre suit la même progression que
// celle que le membre verra à l'écran s'il met sa fiche à jour.
//
// `section` sert au regroupement dans le PDF ; `label` est volontairement
// court, il tient dans une colonne de tableau.
export const PROFILE_FIELDS = [
  // — Identité —
  {
    key: "photo",
    section: "Identité",
    label: "Photo",
    isFilled: (member) => hasText(member.photo),
  },
  {
    key: "registrationNumber",
    section: "Identité",
    label: "Matricule",
    isFilled: (member) => hasText(member.registrationNumber),
  },
  {
    key: "flock",
    section: "Identité",
    label: "Bergerie",
    isFilled: (member) => Boolean(member.flock),
  },

  // — État civil —
  {
    key: "dateOfBirth",
    section: "État civil",
    label: "Date de naissance",
    isFilled: (member) => hasDate(member.dateOfBirth),
  },
  {
    key: "gender",
    section: "État civil",
    label: "Genre",
    isFilled: (member) => hasText(member.gender),
  },
  {
    key: "maritalStatus",
    section: "État civil",
    label: "Situation matrimoniale",
    isFilled: (member) => hasText(member.maritalStatus),
  },
  {
    // 0 enfant est une réponse, pas une absence de réponse : on teste
    // la PRÉSENCE du nombre, jamais sa vérité (`if (childrenCount)`
    // aurait compté toutes les familles sans enfant comme des fiches
    // incomplètes).
    key: "childrenCount",
    section: "État civil",
    label: "Nombre d'enfants",
    isFilled: (member) => hasNumber(member.childrenCount),
  },

  // — Vie spirituelle —
  {
    key: "conversionYear",
    section: "Vie spirituelle",
    label: "Année de conversion",
    isFilled: (member) => hasNumber(member.conversionYear),
  },
  {
    // Deux cases à cocher, donc pas de « vide » lisible : `false` peut
    // vouloir dire « pas baptisé » comme « jamais renseigné ». On ne
    // signale donc le bloc que s'il est ENTIÈREMENT vierge (aucune des
    // deux cases, aucune année) — le seul état dont on puisse affirmer
    // que personne ne l'a rempli.
    key: "baptism",
    section: "Vie spirituelle",
    label: "Baptêmes (eau / Saint-Esprit)",
    isFilled: (member) =>
      Boolean(member.baptism?.water) ||
      Boolean(member.baptism?.holySpirit) ||
      hasNumber(member.baptism?.waterYear),
  },
  {
    key: "baptismWaterYear",
    section: "Vie spirituelle",
    label: "Année du baptême d'eau",
    // Ne se demande QUE si le baptême d'eau est déclaré : réclamer
    // l'année à quelqu'un qui n'est pas encore baptisé n'a pas de sens.
    isFilled: (member) =>
      !member.baptism?.water || hasNumber(member.baptism?.waterYear),
  },

  // — Engagement et service —
  {
    key: "profession",
    section: "Engagement",
    label: "Profession",
    isFilled: (member) => hasText(member.profession),
  },
  {
    key: "skills",
    section: "Engagement",
    label: "Compétences",
    isFilled: (member) =>
      Array.isArray(member.skills) &&
      member.skills.some((skill) => hasText(skill)),
  },
  {
    key: "desiredDepartment",
    section: "Engagement",
    label: "Département souhaité",
    isFilled: (member) => hasText(member.desiredDepartment),
  },
  {
    key: "availability",
    section: "Engagement",
    label: "Disponibilités",
    isFilled: (member) => hasText(member.availability),
  },

  // — Contact —
  {
    key: "phone",
    section: "Contact",
    label: "Téléphone",
    isFilled: (member) => hasText(member.phone),
  },
  {
    key: "whatsapp",
    section: "Contact",
    label: "WhatsApp",
    isFilled: (member) => hasText(member.whatsapp),
  },
  {
    // Rappel : l'e-mail est facultatif côté modèle — beaucoup de
    // membres n'ont que leur téléphone. Il reste listé ici parce que
    // l'objet du document est de savoir QUOI demander, pas de
    // reprocher une absence ; la légende du PDF le précise.
    key: "email",
    section: "Contact",
    label: "E-mail",
    isFilled: (member) => hasText(member.email),
  },
  {
    key: "area",
    section: "Contact",
    label: "Quartier",
    isFilled: (member) => hasText(member.area),
  },
  {
    key: "emergencyContactName",
    section: "Contact",
    label: "Urgence : nom",
    isFilled: (member) => hasText(member.emergencyContact?.name),
  },
  {
    key: "emergencyContactPhone",
    section: "Contact",
    label: "Urgence : téléphone",
    isFilled: (member) => hasText(member.emergencyContact?.phone),
  },
];

export const TOTAL_PROFILE_FIELDS = PROFILE_FIELDS.length;

// Les champs vides d'un membre, dans l'ordre de `PROFILE_FIELDS`.
// Tableau vide = fiche complète.
export const missingProfileFields = (member) =>
  PROFILE_FIELDS.filter((field) => !field.isFilled(member));

export const missingProfileLabels = (member) =>
  missingProfileFields(member).map((field) => field.label);

// Part de la fiche effectivement remplie, en pourcentage entier — sert
// à trier la liste de relance : les fiches les plus vides en premier,
// ce sont elles qui coûtent le plus cher à laisser en l'état.
export const profileCompletion = (member) => {
  const missing = missingProfileFields(member).length;

  return Math.round(((TOTAL_PROFILE_FIELDS - missing) / TOTAL_PROFILE_FIELDS) * 100);
};

export const isProfileComplete = (member) =>
  missingProfileFields(member).length === 0;
