import dotenv from "dotenv";

dotenv.config();

// Lecture et validation de l'environnement.
//
// PRINCIPE : aucune valeur de repli en dur pour un secret. Si
// `JWT_SECRET` est absent, le serveur refuse de démarrer plutôt que de
// signer des jetons avec une valeur devinable. Un défaut « pratique »
// finit toujours par se retrouver en production.
//
// `validateEnv()` ne lève pas à l'import : `server.js` l'appelle dans un
// try/catch pour afficher un message lisible au lieu d'une stack trace.

const read = (name) => {
  const value = process.env[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const NODE_ENV = read("NODE_ENV") ?? "development";
const isProduction = NODE_ENV === "production";

export const env = {
  NODE_ENV,
  isProduction,
  isTest: NODE_ENV === "test",

  PORT: Number.parseInt(read("PORT") ?? "4000", 10),

  MONGODB_URI: read("MONGODB_URI"),

  JWT_SECRET: read("JWT_SECRET"),
  JWT_EXPIRES_IN: read("JWT_EXPIRES_IN") ?? "7d",
  JWT_ISSUER: "cava-api",

  // Origines autorisées à appeler l'API. Plusieurs valeurs possibles,
  // séparées par des virgules (site public + interface d'administration).
  //
  // La barre oblique finale est retirée, et ce n'est pas cosmétique :
  // un navigateur envoie toujours `Origin: https://exemple.com`, jamais
  // avec un `/` final. La comparaison du module `cors` étant une égalité
  // stricte de chaînes, une valeur copiée depuis la barre d'adresse
  // (« https://exemple.com/ ») ne correspondrait jamais — et la panne se
  // manifeste par un formulaire qui échoue sans message, très loin de sa
  // cause.
  CORS_ORIGIN: (read("CORS_ORIGIN") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),

  // Nombre de proxys de confiance devant l'API. À régler à 1 derrière
  // Vercel/Render, sinon le rate limiting compte toutes les requêtes
  // sur l'IP du proxy. Laisser à 0 en local : faire confiance à
  // `X-Forwarded-For` sans proxy réel permet de falsifier son IP et
  // donc de contourner les limites.
  TRUST_PROXY: Number.parseInt(read("TRUST_PROXY") ?? "0", 10),

  // Webhook de reconstruction du site public. Secret de fait :
  // il reste côté serveur, jamais dans le bundle du front.
  VERCEL_DEPLOY_HOOK: read("VERCEL_DEPLOY_HOOK"),

  // Comptes d'amorçage — utilisés uniquement par `npm run seed`.
  SEED_ADMIN_NAME: read("SEED_ADMIN_NAME"),
  SEED_ADMIN_EMAIL: read("SEED_ADMIN_EMAIL"),
  SEED_ADMIN_PASSWORD: read("SEED_ADMIN_PASSWORD"),
};

// Longueur minimale du secret JWT. 32 caractères correspondent à la
// taille de la clé HMAC-SHA256 : en dessous, la signature est plus
// faible que l'algorithme qui l'utilise.
const MIN_SECRET_LENGTH = 32;

export function validateEnv({ requireSeedAdmin = false } = {}) {
  const problems = [];

  if (!env.MONGODB_URI) {
    problems.push(
      "MONGODB_URI est absente. Renseignez la chaîne de connexion MongoDB dans .env."
    );
  }

  if (!env.JWT_SECRET) {
    problems.push(
      "JWT_SECRET est absente. Générez une valeur aléatoire :\n" +
        '      node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  } else if (env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
    problems.push(
      `JWT_SECRET est trop courte (${env.JWT_SECRET.length} caractères, ${MIN_SECRET_LENGTH} minimum).`
    );
  }

  if (!Number.isInteger(env.PORT) || env.PORT < 1 || env.PORT > 65535) {
    problems.push("PORT doit être un entier entre 1 et 65535.");
  }

  if (!Number.isInteger(env.TRUST_PROXY) || env.TRUST_PROXY < 0) {
    problems.push("TRUST_PROXY doit être un entier positif ou nul.");
  }

  // En production, une origine explicite est obligatoire : sans elle on
  // ne saurait pas quoi autoriser, et le réflexe serait d'ouvrir à tous.
  if (env.isProduction && env.CORS_ORIGIN.length === 0) {
    problems.push(
      "CORS_ORIGIN est absente. En production, l'origine du site doit être déclarée explicitement."
    );
  }

  if (requireSeedAdmin) {
    if (!env.SEED_ADMIN_EMAIL) {
      problems.push("SEED_ADMIN_EMAIL est absente (requise par le script d'amorçage).");
    }

    if (!env.SEED_ADMIN_PASSWORD) {
      problems.push("SEED_ADMIN_PASSWORD est absente (requise par le script d'amorçage).");
    } else if (env.SEED_ADMIN_PASSWORD.length < 10) {
      problems.push(
        "SEED_ADMIN_PASSWORD doit faire au moins 10 caractères (contrainte du modèle User)."
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      "Configuration invalide — le serveur ne peut pas démarrer :\n" +
        problems.map((problem) => `  - ${problem}`).join("\n") +
        "\n\nVoir .env.example pour la liste complète des variables attendues."
    );
  }

  return env;
}

// Origines autorisées en développement quand CORS_ORIGIN n'est pas
// renseignée. Volontairement limité au serveur de dev Vite : ce repli
// n'existe pas en production, où la validation ci-dessus l'exige.
export const resolveCorsOrigins = () =>
  env.CORS_ORIGIN.length > 0
    ? env.CORS_ORIGIN
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
