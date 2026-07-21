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

  // Stockage des fichiers envoyés depuis l'administration.
  //
  // `CLOUDINARY_API_SECRET` ne quitte JAMAIS le serveur : il sert à
  // signer les envois. Le navigateur reçoit une signature à usage
  // unique, valable pour un dossier et un instant donnés, mais jamais
  // la clé qui l'a produite — sinon n'importe quel visiteur du bundle
  // pourrait téléverser sur votre compte.
  CLOUDINARY_CLOUD_NAME: read("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: read("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: read("CLOUDINARY_API_SECRET"),

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

  // ---- Encaissement des dons (CinetPay) ------------------------
  //
  // `CINETPAY_SECRET_KEY` est la clé de vérification des notifications :
  // elle ne quitte jamais le serveur. C'est elle qui distingue une
  // notification authentique de n'importe quelle requête POST envoyée
  // à la main sur notre URL de retour — sans elle, il suffirait de
  // connaître l'adresse du webhook pour se déclarer donateur.
  //
  // Aucune de ces valeurs n'est préfixée `VITE_` : elles seraient
  // sinon compilées dans le bundle et lisibles par tout visiteur.
  CINETPAY_API_KEY: read("CINETPAY_API_KEY"),
  CINETPAY_SITE_ID: read("CINETPAY_SITE_ID"),
  CINETPAY_SECRET_KEY: read("CINETPAY_SECRET_KEY"),

  CINETPAY_BASE_URL:
    read("CINETPAY_BASE_URL") ?? "https://api-checkout.cinetpay.com/v2",

  // Adresse publique du site, utilisée pour construire l'URL de retour
  // du donateur. Doit être l'origine réelle : une valeur erronée
  // renverrait les donateurs vers une page inexistante après paiement.
  PUBLIC_SITE_URL: (
    read("PUBLIC_SITE_URL") ?? "http://localhost:5173"
  ).replace(/\/+$/, ""),

  // Adresse publique de l'API, pour l'URL de notification serveur à
  // serveur. Distincte de PUBLIC_SITE_URL : le site est sur Vercel,
  // l'API sur Render.
  PUBLIC_API_URL: (read("PUBLIC_API_URL") ?? "").replace(/\/+$/, ""),

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

  // Encaissement des dons.
  //
  // Volontairement facultatif : le serveur doit démarrer sans, le temps
  // que le compte marchand soit ouvert. En revanche une configuration
  // À MOITIÉ renseignée est refusée — c'est le cas qui produirait des
  // dons initiés mais jamais vérifiables, donc de l'argent encaissé
  // sans trace exploitable.
  const paymentKeys = [
    "CINETPAY_API_KEY",
    "CINETPAY_SITE_ID",
    "CINETPAY_SECRET_KEY",
  ];

  const provided = paymentKeys.filter((key) => env[key]);

  if (provided.length > 0 && provided.length < paymentKeys.length) {
    const missing = paymentKeys.filter((key) => !env[key]);

    problems.push(
      "Configuration CinetPay incomplète. Manquant : " +
        missing.join(", ") +
        ". Renseignez les trois variables, ou aucune pour désactiver les dons en ligne."
    );
  }

  if (provided.length === paymentKeys.length) {
    if (!env.PUBLIC_API_URL) {
      problems.push(
        "PUBLIC_API_URL est absente alors que CinetPay est configuré. " +
          "Sans elle, le prestataire ne sait pas où notifier le paiement et aucun don ne sera jamais confirmé."
      );
    } else if (env.isProduction && !env.PUBLIC_API_URL.startsWith("https://")) {
      problems.push(
        "PUBLIC_API_URL doit être en https en production : la notification de paiement y transite."
      );
    }

    if (env.isProduction && !env.PUBLIC_SITE_URL.startsWith("https://")) {
      problems.push(
        "PUBLIC_SITE_URL doit être en https en production (URL de retour du donateur)."
      );
    }
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

// Les dons en ligne sont-ils utilisables ?
//
// Interrogé par les routes plutôt que de laisser un appel partir vers
// CinetPay avec des clés vides : le donateur recevrait une erreur
// technique du prestataire au lieu d'un message clair de notre part.
export const isPaymentConfigured = () =>
  Boolean(
    env.CINETPAY_API_KEY &&
      env.CINETPAY_SITE_ID &&
      env.CINETPAY_SECRET_KEY &&
      env.PUBLIC_API_URL
  );

// Origines autorisées en développement quand CORS_ORIGIN n'est pas
// renseignée. Volontairement limité au serveur de dev Vite : ce repli
// n'existe pas en production, où la validation ci-dessus l'exige.
export const resolveCorsOrigins = () =>
  env.CORS_ORIGIN.length > 0
    ? env.CORS_ORIGIN
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
