// Protection contre l'injection d'opérateurs MongoDB.
//
// LE PROBLÈME
// Express transforme `?status[$ne]=x` en `{ status: { $ne: "x" } }`.
// Passé tel quel à Mongoose, ce n'est plus une valeur mais un
// OPÉRATEUR : le filtre est inversé. Testé sur ce projet, la requête
// `/api/admin/events?status[$ne]=xxx` renvoyait la totalité des
// événements au lieu de zéro.
//
// Même mécanisme dans un corps JSON : `{ "email": { "$ne": null } }`
// sur une route de connexion permet de s'authentifier sans connaître
// d'adresse valide.
//
// LA PARADE
// Deux barrières complémentaires :
//   1. `stripOperators` retire toute clé commençant par `$` ou
//      contenant un `.` (notation pointée) du corps et des paramètres ;
//   2. `asString` (utilisé dans les services) force les valeurs
//      attendues comme du texte à être du texte.
//
// Une seule des deux suffirait dans la plupart des cas. Les deux sont
// en place parce que celle qui manque est toujours celle dont on
// aurait eu besoin.

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

const clean = (value, depth = 0) => {
  // Garde-fou contre les structures profondément imbriquées, qui
  // pourraient servir à saturer le processus.
  if (depth > 8) return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => clean(item, depth + 1));
  }

  if (!isPlainObject(value)) return value;

  const out = {};

  for (const [key, val] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".")) continue;

    // Neutralise aussi la pollution de prototype.
    if (
      key === "__proto__" ||
      key === "constructor" ||
      key === "prototype"
    ) {
      continue;
    }

    const cleaned = clean(val, depth + 1);

    if (cleaned !== undefined) out[key] = cleaned;
  }

  return out;
};

export const stripOperators = (req, _res, next) => {
  if (req.body) req.body = clean(req.body);

  // `req.query` est en lecture seule sur Express 5 : on ne peut pas
  // le réassigner, il faut modifier ses clés en place.
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];

      if (isPlainObject(value) || Array.isArray(value)) {
        delete req.query[key];
      }
    }
  }

  next();
};

// Force une valeur à être une chaîne exploitable, ou `undefined`.
// À utiliser sur tout paramètre qui alimente un filtre de requête.
export const asString = (value, maxLength = 200) => {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : undefined;
};
