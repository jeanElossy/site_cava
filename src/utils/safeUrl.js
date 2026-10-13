// Filtrage des adresses saisies dans l'administration avant de les placer
// dans un `href` ou un `src` public.
//
// React 19 neutralise déjà `javascript:`, mais pas `data:`, `vbscript:` ni
// une adresse mal formée. Une valeur refusée retombe sur `fallback` : le
// lien reste utilisable, il ne mène simplement pas où l'adresse douteuse
// voulait l'envoyer. L'API valide aussi ces champs (modèle `Media`) — ce
// filtre est la seconde barrière, pour les données déjà en base.

// Lien externe : `http:` ou `https:` uniquement.
export const safeHttpUrl = (value, fallback = null) => {
  if (typeof value !== "string" || value.trim() === "") return fallback;

  try {
    const url = new URL(value.trim());

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : fallback;
  } catch {
    return fallback;
  }
};

// Source de média : chemin interne au site (`/videos/…`) ou adresse
// `https:`. `//hote` (relatif au protocole) est refusé : il désigne un
// autre site, pas un chemin local.
export const safeMediaSrc = (value, fallback = null) => {
  if (typeof value !== "string" || value.trim() === "") return fallback;

  const trimmed = value.trim();

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

  const url = safeHttpUrl(trimmed);

  return url && url.startsWith("https:") ? url : fallback;
};
