// Période de validité d'un remplacement de moniteur.
//
// ------------------------------------------------------------------
// POURQUOI CES FONCTIONS SONT PURES, ET POURQUOI IL N'Y A PAS DE JOB
// ------------------------------------------------------------------
// Un remplacement expire. La tentation est d'écrire un job nocturne
// qui passe les remplacements échus au statut « expiré » — c'est
// précisément ce qu'il ne faut pas faire : entre la fin réelle et le
// passage du job, l'accès à la classe resterait ouvert. Le cahier des
// charges exige l'inverse (« après expiration, l'accès à la deuxième
// classe est automatiquement supprimé »).
//
// L'expiration se CALCULE donc à chaque lecture, et le statut ne porte
// que ce qu'un humain a décidé : `valide` ou `annule`. Même principe
// que `getEffectiveWindow` pour les QR de badgeage, où la base reste
// seule autorité et la validité se recalcule à chaque vérification.
//
// ------------------------------------------------------------------
// FUSEAU HORAIRE
// ------------------------------------------------------------------
// Abidjan est à UTC+0 toute l'année (pas d'heure d'été en Côte
// d'Ivoire). Comparer les jours en UTC donne donc exactement le jour
// civil vécu sur place, sans conversion. Cette égalité est une
// propriété du lieu, pas une simplification : si le module devait un
// jour servir une assemblée dans un autre fuseau, ces fonctions
// seraient le seul endroit à revoir.

// Clé de jour civil : « 2026-08-30 ». Comparer des chaînes de cette
// forme revient à comparer des jours, sans jamais se heurter aux
// heures, minutes et millisecondes que porte un `Date`.
export const dayKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
};

export const SUBSTITUTION_MODES = ["session", "sessions", "period"];

// Le remplacement couvre-t-il ce jour-là ?
//
// `substitution.sessionDates` est dénormalisé au moment de la création
// (voir substitution.service.js) : sans lui, chaque contrôle d'accès
// devrait charger les séances référencées — or ce contrôle est fait à
// CHAQUE requête d'un moniteur, pas une fois par jour.
export const isSubstitutionActiveAt = (substitution, at = new Date()) => {
  if (!substitution || substitution.status !== "valide") return false;

  const day = dayKey(at);

  if (!day) return false;

  if (substitution.mode === "period") {
    const start = dayKey(substitution.startDate);
    const end = dayKey(substitution.endDate);

    if (!start || !end) return false;

    return day >= start && day <= end;
  }

  // Modes « session » et « sessions » : la liste des jours couverts est
  // explicite. Un remplacement sans aucun jour ne couvre rien — il ne
  // « couvre pas tout » par défaut, ce qui serait le pire des replis
  // pour une règle d'accès.
  return (substitution.sessionDates ?? [])
    .map((date) => dayKey(date))
    .includes(day);
};

// Bornes affichables d'un remplacement — pour l'interface et les
// listes d'administration, jamais pour décider d'un accès (c'est le
// rôle de `isSubstitutionActiveAt`, qui gère aussi les jours épars du
// mode « sessions »).
export const substitutionBounds = (substitution) => {
  if (!substitution) return { from: null, to: null };

  if (substitution.mode === "period") {
    return { from: substitution.startDate ?? null, to: substitution.endDate ?? null };
  }

  const dates = (substitution.sessionDates ?? [])
    .filter((date) => date instanceof Date || typeof date === "string")
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);

  if (dates.length === 0) return { from: null, to: null };

  return { from: dates[0], to: dates[dates.length - 1] };
};

// Deux remplacements se chevauchent-ils ? Utilisé avant écriture pour
// refuser un doublon incohérent (voir substitution.service.js).
//
// MongoDB ne sait pas indexer un intervalle : cette vérification ne
// peut pas être une contrainte de schéma, elle est nécessairement
// applicative. Elle compare des ENSEMBLES DE JOURS, ce qui traite du
// même coup les trois modes et leurs croisements — une période qui
// englobe une séance isolée est bien détectée.
export const substitutionsOverlap = (a, b) => {
  const daysOf = (substitution) => {
    if (substitution.mode === "period") {
      const start = dayKey(substitution.startDate);
      const end = dayKey(substitution.endDate);

      if (!start || !end) return [];

      // Une période reste courte par nature (quelques semaines) :
      // l'énumérer jour par jour est sans conséquence, et évite un
      // second chemin de comparaison qui divergerait du premier.
      const days = [];
      const cursor = new Date(`${start}T00:00:00.000Z`);
      const last = new Date(`${end}T00:00:00.000Z`);

      while (cursor <= last) {
        days.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      return days;
    }

    return (substitution.sessionDates ?? [])
      .map((date) => dayKey(date))
      .filter(Boolean);
  };

  const daysOfB = new Set(daysOf(b));

  return daysOf(a).some((day) => daysOfB.has(day));
};
