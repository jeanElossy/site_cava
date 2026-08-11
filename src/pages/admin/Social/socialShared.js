// Utilitaires partagés entre les quatre écrans du module Service
// Social (dashboard, cotisations, membres, caisse) — factorisés ici
// plutôt que dupliqués, sur le même principe que `data.js` pour le
// tunnel d'inscription (voir components/registration/RegistrationForm/data.js).

import { churches as churchesApi } from "../../../services/api";
import useAsyncData from "../../../hooks/useAsyncData";
import { formatRegistrationNumber } from "../../../utils/registrationNumber";

// Les églises réelles (numéro + nom, ex. « Centre Apostolique Vie et
// Abondance (CAVA) » pour l'église 1) viennent de la ressource
// `churches` déjà administrée ailleurs (voir CommunityAdmin.jsx),
// jamais d'un libellé générique « Église N » codé en dur — un module
// social sur cinq églises fictives serait trompeur tant que seule la
// première existe réellement.
export const useChurchOptions = () => {
  const { data, loading, error, reload } = useAsyncData(churchesApi.listAdmin);

  const options = (data ?? [])
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((church) => ({ value: church.number, label: church.name }));

  return { options, loading, error, reload };
};

// Repli seulement si un numéro d'église n'a pas (ou plus) de fiche
// `Church` correspondante — même convention que `churchLabelFrom` dans
// RegistrationForm/data.js.
export const churchLabelFrom = (churchOptions, value) => {
  if (!value) return "Toutes les églises";

  return (
    churchOptions.find((church) => Number(church.value) === Number(value))
      ?.label ?? `Église ${value}`
  );
};

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export const monthLabel = (month) => MONTHS[(Number(month) || 1) - 1] ?? "—";

export const MONTH_OPTIONS = MONTHS.map((label, index) => ({
  value: index + 1,
  label,
}));

export const money = (value) => `${Number(value ?? 0).toLocaleString("fr-FR")} F`;

export const formatDateTime = (value) => {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Date et heure séparées, pour les tableaux qui leur consacrent une
// colonne chacune (voir SocialCaisse.jsx).
export const formatDateOnly = (value) => {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatTimeOnly = (value) => {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

// « En retard » n'est pas un statut renvoyé par l'API pour une ligne
// individuelle (voir CLAUDE.md / contrat API) : c'est une valeur
// dérivée, calculée avec la date du navigateur, uniquement pour
// l'affichage d'un badge.
export const isPastMonth = (year, month) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (Number(year) < currentYear) return true;
  if (Number(year) > currentYear) return false;

  return Number(month) < currentMonth;
};

export const isLate = (item) =>
  (item.status === "non_paye" || item.status === "partiel") &&
  isPastMonth(item.year, item.month);

export const STATUS = {
  non_paye: { label: "Non payé" },
  paye: { label: "Payé" },
  partiel: { label: "Partiel" },
  exonere: { label: "Exonéré" },
  annule: { label: "Annulé" },
};

export const memberName = (member) =>
  [member?.firstName, member?.lastName].filter(Boolean).join(" ") || "—";

export const memberMatricule = (member) =>
  member?.registrationNumber
    ? formatRegistrationNumber(member.registrationNumber)
    : "—";

// `flock`/`recordedBy` peuvent arriver soit peuplés (objet Mongoose
// avec `.name`), soit sous forme d'identifiant brut selon ce que
// l'agrégation renvoie côté serveur — l'un et l'autre sont couverts
// sans faire planter l'affichage.
export const flockLabel = (flock) =>
  (flock && typeof flock === "object" ? flock.name : flock) || "—";

export const recordedByLabel = (recordedBy) =>
  (recordedBy && typeof recordedBy === "object" ? recordedBy.name : recordedBy) ||
  "—";

// Déclenche le téléchargement d'un blob déjà récupéré (voir
// services/social.js#fetchContributionReceipt) via une URL objet
// temporaire : le PDF est authentifié, un <a href> direct ne pourrait
// pas porter le jeton jusqu'au serveur.
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

// Modèle de message imposé par le cahier des charges (section 11).
// Volontairement sans numéro cible : le format des numéros stockés
// n'est pas garanti fiable, on laisse l'agent choisir le contact dans
// WhatsApp plutôt que de risquer un envoi au mauvais destinataire.
export const buildWhatsAppMessage = ({
  firstName,
  month,
  year,
  amount,
  matricule,
  date,
  reference,
}) =>
  `Bonjour ${firstName},\n\nVotre cotisation sociale du mois de ${month} ${year} a bien été enregistrée.\n\nMontant : ${amount} FCFA\nMatricule : ${matricule}\nDate : ${date}\nRéférence : ${reference}\n\nMerci.`;

export const whatsAppUrl = (message) =>
  `https://wa.me/?text=${encodeURIComponent(message)}`;
