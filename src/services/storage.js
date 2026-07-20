// Persistance locale temporaire (navigateur).
//
// ------------------------------------------------------------------
// À REMPLACER LORS DU BRANCHEMENT DU BACKEND
// ------------------------------------------------------------------
// Ce module simule une base de données dans le localStorage du
// navigateur. Il permet de développer et de démontrer l'espace
// d'administration avant l'existence d'une API.
//
// Limites assumées, à ne pas oublier :
//   - les données ne sortent pas du navigateur (rien n'est partagé
//     entre l'admin et les visiteurs, ni entre deux appareils) ;
//   - vider le cache du navigateur efface tout ;
//   - aucune sécurité : le contenu est modifiable depuis la console.
//
// Quand l'API existera, seul `src/services/api.js` sera à réécrire.
// Ce fichier pourra alors être supprimé.

const PREFIX = "cava:";

// Le stockage peut être indisponible (navigation privée, quotas,
// paramètres stricts) : on ne laisse jamais l'application planter.
const safeParse = (raw, fallback) => {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const read = (key, fallback) => {
  try {
    return safeParse(
      window.localStorage.getItem(PREFIX + key),
      fallback
    );
  } catch {
    return fallback;
  }
};

export const write = (key, value) => {
  try {
    window.localStorage.setItem(
      PREFIX + key,
      JSON.stringify(value)
    );

    return true;
  } catch {
    return false;
  }
};

export const remove = (key) => {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* stockage indisponible : rien à faire */
  }
};

// Amorce une collection avec les données existantes du site la
// première fois seulement, pour que l'admin ne démarre pas vide.
export const seed = (key, initial) => {
  const existing = read(key, null);

  if (existing !== null) return existing;

  write(key, initial);

  return initial;
};

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
