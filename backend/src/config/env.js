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

// Origines autorisées, calculées avant l'objet : `PUBLIC_SITE_URL` en
// dérive quand elle n'est pas renseignée, et un littéral d'objet ne
// peut pas référencer ses propres champs.
const corsOrigins = (read("CORS_ORIGIN") ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Adresse publique du site.
//
// ------------------------------------------------------------------
// POURQUOI ELLE SE DÉDUIT DE CORS_ORIGIN
// ------------------------------------------------------------------
// Elle sert à construire l'URL de retour du donateur et le lien encodé
// dans les QR codes de don. Une valeur erronée ne casse rien
// visiblement : elle produit un QR code parfaitement lisible, qui mène
// simplement nulle part.
//
// C'est arrivé. Le QR généré depuis l'administration en production
// pointait vers `http://localhost:5173`, parce que la variable n'était
// pas renseignée sur le serveur et retombait sur son défaut de
// développement. Affiché sur l'écran d'un culte, personne ne l'aurait
// vu avant que la salle entière n'échoue à donner.
//
// `CORS_ORIGIN` contient déjà l'adresse réelle du site — c'est sa
// raison d'être. La déduire de là supprime une variable à oublier, et
// le défaut localhost ne subsiste qu'en développement, là où il est
// juste.
const publicSiteUrl = (
  read("PUBLIC_SITE_URL") ??
  corsOrigins[0] ??
  "http://localhost:5173"
).replace(/\/+$/, "");

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
  CORS_ORIGIN: corsOrigins,

  // Nombre de proxys de confiance devant l'API. À régler à 1 derrière
  // Vercel/Render, sinon le rate limiting compte toutes les requêtes
  // sur l'IP du proxy. Laisser à 0 en local : faire confiance à
  // `X-Forwarded-For` sans proxy réel permet de falsifier son IP et
  // donc de contourner les limites.
  TRUST_PROXY: Number.parseInt(read("TRUST_PROXY") ?? "0", 10),

  // Webhook de reconstruction du site public. Secret de fait :
  // il reste côté serveur, jamais dans le bundle du front.
  VERCEL_DEPLOY_HOOK: read("VERCEL_DEPLOY_HOOK"),

  // Voir le calcul et son explication plus haut.
  PUBLIC_SITE_URL: publicSiteUrl,

  // Adresse publique de l'API, pour l'URL de notification serveur à
  // serveur. Distincte de PUBLIC_SITE_URL : le site est sur Vercel,
  // l'API sur Render.
  PUBLIC_API_URL: (read("PUBLIC_API_URL") ?? "").replace(/\/+$/, ""),

  // Comptes d'amorçage — utilisés uniquement par `npm run seed`.
  SEED_ADMIN_NAME: read("SEED_ADMIN_NAME"),
  SEED_ADMIN_EMAIL: read("SEED_ADMIN_EMAIL"),
  SEED_ADMIN_PASSWORD: read("SEED_ADMIN_PASSWORD"),

  // ---- Notifications push (agents SOA/CANA) ---------------------
  //
  // Facultatif : le serveur démarre sans, les agents n'ont simplement
  // pas la proposition d'activer les notifications. `VAPID_PUBLIC_KEY`
  // seule part aussi vers le front (voir routes/index.js,
  // /api/push/vapid-public-key — une clé PUBLIQUE, son nom le dit) ;
  // `VAPID_PRIVATE_KEY` ne quitte jamais le serveur, elle signe les
  // envois.
  VAPID_PUBLIC_KEY: read("VAPID_PUBLIC_KEY"),
  VAPID_PRIVATE_KEY: read("VAPID_PRIVATE_KEY"),
  VAPID_SUBJECT: read("VAPID_SUBJECT"),
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

  // Une adresse locale en production produit des liens qui ne mènent
  // nulle part — QR code de don et URL de retour du donateur. Rien ne
  // le signalerait au moment où c'est fait ; autant refuser de démarrer.
  if (
    env.isProduction &&
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(env.PUBLIC_SITE_URL)
  ) {
    problems.push(
      `PUBLIC_SITE_URL vaut « ${env.PUBLIC_SITE_URL} » en production. ` +
        "Renseignez l'adresse publique du site, ou placez-la en première position de CORS_ORIGIN."
    );
  }

  // Notifications push : même principe que les variables optionnelles — les
  // trois variables ensemble, ou aucune.
  const pushKeys = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
  const providedPushKeys = pushKeys.filter((key) => env[key]);

  if (providedPushKeys.length > 0 && providedPushKeys.length < pushKeys.length) {
    const missing = pushKeys.filter((key) => !env[key]);

    problems.push(
      "Configuration des notifications push incomplète. Manquant : " +
        missing.join(", ") +
        ". Renseignez les trois variables (voir README pour générer une paire VAPID), ou aucune pour désactiver les notifications push."
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

  // Avertissement NON bloquant : signalé fort au démarrage, mais sans
  // empêcher le serveur de tourner. TRUST_PROXY à 0 en production est
  // presque toujours un oubli — l'API voit alors l'IP du proxy au lieu
  // de celle du client, et la limitation de débit compte tout le trafic
  // sur cette unique adresse, un plafond partagé par le site entier. On
  // ne REFUSE pas de démarrer (un déploiement bloqué serait pire qu'un
  // rate limiting mal calibré), mais on le crie dans les logs pour que
  // le premier coup d'œil au tableau de bord Render le rattrape.
  const warnings = [];

  if (env.isProduction && env.TRUST_PROXY === 0) {
    warnings.push(
      "TRUST_PROXY vaut 0 en production. Derrière Render/Vercel, réglez-la à 1, " +
        "sinon la limitation de débit compte toutes les requêtes sur l'IP du proxy " +
        "et peut bloquer le site entier au premier pic de charge."
    );
  }

  if (warnings.length > 0) {
    console.warn(
      "\n⚠️  Avertissements de configuration :\n" +
        warnings.map((warning) => `  - ${warning}`).join("\n") +
        "\n"
    );
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

// Les notifications push sont-elles utilisables ?
//
// Interrogé par push.service.js avant tout envoi, plutôt que de
// laisser `web-push` échouer avec des clés vides.
export const isPushConfigured = () =>
  Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);

// Origines autorisées en développement quand CORS_ORIGIN n'est pas
// renseignée. Volontairement limité au serveur de dev Vite : ce repli
// n'existe pas en production, où la validation ci-dessus l'exige.
export const resolveCorsOrigins = () =>
  env.CORS_ORIGIN.length > 0
    ? env.CORS_ORIGIN
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
