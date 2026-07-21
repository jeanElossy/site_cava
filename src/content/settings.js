import stored from "./settings.json";

// Paramètres du site : coordonnées, horaires réguliers, réseaux sociaux.
//
// ------------------------------------------------------------------
// POURQUOI DES VALEURS DE REPLI
// ------------------------------------------------------------------
// Ces réglages sont modifiables depuis l'administration, mais la base
// ne les contient pas encore tous. Brancher les composants dessus sans
// filet aurait vidé le pied de page et la page Contact dès la première
// reconstruction.
//
// Chaque valeur ci-dessous reprend donc EXACTEMENT ce qui était écrit
// en dur dans les composants jusqu'ici. Le site reste identique tant
// que rien n'est saisi, et chaque champ renseigné dans l'administration
// prend automatiquement le dessus.
//
// ⚠️ Ces valeurs de repli sont des exemples hérités de la maquette :
// le numéro de téléphone et l'adresse e-mail ne sont pas ceux de
// l'église. Elles ont vocation à disparaître une fois les vrais
// réglages saisis.

const FALLBACK = {
  churchName: "Centre Apostolique Vie et Abondance",
  phonePrimary: "+225 07 12 34 56 78",
  phoneSecondary: "",
  email: "info@cava.ci",
  address: "Abidjan, Côte d'Ivoire",

  serviceTimes: [
    {
      label: "Culte dominical",
      day: "dimanche",
      time: "09h00",
      description: "Louange, enseignement et prière.",
    },
    {
      label: "École du dimanche",
      day: "dimanche",
      time: "09h00",
      description: "Enseignement biblique adapté aux enfants.",
    },
    {
      label: "Réunion de prière",
      day: "mercredi",
      time: "18h30",
      description:
        "Intercession pour nos familles et notre nation.",
    },
    {
      label: "Accueil & secrétariat",
      day: "lundi",
      time: "08h00 - 17h00",
      description: "Une équipe disponible pour vous orienter.",
    },
  ],

  social: {
    facebook: "https://facebook.com",
    instagram: "https://instagram.com",
    youtube: "https://youtube.com",
    whatsapp: "https://wa.me/2250712345678",
  },
};

// Une chaîne vide en base ne doit PAS écraser le repli : c'est un champ
// non renseigné, pas une suppression volontaire.
const pick = (value, fallback) => {
  if (typeof value === "string") return value.trim() || fallback;

  if (Array.isArray(value)) return value.length ? value : fallback;

  return value ?? fallback;
};

export const site = {
  churchName: pick(stored.churchName, FALLBACK.churchName),
  phonePrimary: pick(stored.phonePrimary, FALLBACK.phonePrimary),
  phoneSecondary: pick(
    stored.phoneSecondary,
    FALLBACK.phoneSecondary
  ),
  email: pick(stored.email, FALLBACK.email),
  address: pick(stored.address, FALLBACK.address),
  serviceTimes: pick(stored.serviceTimes, FALLBACK.serviceTimes),
  social: {
    facebook: pick(
      stored.social?.facebook,
      FALLBACK.social.facebook
    ),
    instagram: pick(
      stored.social?.instagram,
      FALLBACK.social.instagram
    ),
    youtube: pick(stored.social?.youtube, FALLBACK.social.youtube),
    whatsapp: pick(
      stored.social?.whatsapp,
      FALLBACK.social.whatsapp
    ),
  },
};

const JOURS = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
};

export const dayLabel = (day) => JOURS[day] ?? day ?? "";

// Lien téléphonique utilisable : les espaces d'affichage empêchent
// l'appel direct depuis un mobile.
export const telHref = (value) =>
  `tel:${String(value ?? "").replace(/[^\d+]/g, "")}`;

export default site;
