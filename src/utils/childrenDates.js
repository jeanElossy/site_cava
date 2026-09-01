// Dates telles que les maquettes les affichent : « 27 mai 2026 » avec,
// en dessous, « Aujourd'hui », « Demain » ou le jour de la semaine.
//
// Ce repère relatif n'est pas cosmétique : sur un écran de
// remplacements, ce qu'on cherche d'abord, c'est ce qui se passe
// AUJOURD'HUI. Le lire dans une colonne de dates absolues demande de
// comparer mentalement chaque ligne à la date du jour.
//
// Abidjan est à UTC+0 : le jour UTC est le jour vécu sur place, et la
// comparaison ne souffre d'aucun décalage (même raisonnement que
// backend/src/utils/substitutionWindow.js).

const dayKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
};

export const formatLongDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const formatShortDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("fr-FR");
};

/**
 * Repère relatif, ou `null` si la date est trop lointaine pour qu'un
 * repère aide (au-delà d'une semaine, « dans 23 jours » n'apprend rien
 * de plus que la date elle-même).
 */
export const relativeDay = (value, now = new Date()) => {
  const key = dayKey(value);
  const todayKey = dayKey(now);

  if (!key || !todayKey) return null;

  if (key === todayKey) return "Aujourd'hui";

  const target = new Date(`${key}T00:00:00.000Z`);
  const today = new Date(`${todayKey}T00:00:00.000Z`);

  const days = Math.round((target - today) / 86400000);

  if (days === 1) return "Demain";
  if (days === -1) return "Hier";

  if (days > 1 && days <= 6) {
    // Le nom du jour suffit dans la semaine à venir : « samedi » se
    // situe sans effort, « dans 4 jours » demande un calcul.
    return target.toLocaleDateString("fr-FR", { weekday: "long" });
  }

  return null;
};
