import express from "express";
import helmet from "helmet";
import cors from "cors";

import { env, resolveCorsOrigins } from "./config/env.js";
import { buildRoutes } from "./routes/index.js";
import { globalLimiter } from "./middlewares/rateLimit.js";
import { stripOperators } from "./middlewares/sanitize.js";
import { notFound, errorHandler } from "./middlewares/error.js";

export const createApp = () => {
  const app = express();

  // Derrière un proxy (Render, Vercel), `X-Forwarded-For` porte la
  // vraie IP du client. Sans ce réglage, le rate limiting compterait
  // toutes les requêtes sur l'IP du proxy — donc bloquerait tout le
  // monde d'un coup. Voir le commentaire de TRUST_PROXY dans env.js.
  app.set("trust proxy", env.TRUST_PROXY);

  // Masque la signature Express.
  app.disable("x-powered-by");

  app.use(helmet());

  const origins = resolveCorsOrigins();

  app.use(
    cors({
      origin: origins,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      // Pas de cookie : l'authentification passe par un en-tête
      // Authorization, ce qui évite d'emblée la surface CSRF.
      credentials: false,
      maxAge: 86400,
    })
  );

  // Limite de taille : un corps de requête non borné est un vecteur
  // de déni de service trivial.
  app.use(express.json({ limit: "100kb" }));

  // Le prestataire de paiement notifie en `application/x-www-form-urlencoded`,
  // pas en JSON. Sans ce lecteur, `req.body` serait vide sur le webhook :
  // la signature ne correspondrait jamais et aucun don ne serait
  // confirmé, sans erreur visible côté site.
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  // Retire tout opérateur MongoDB des entrées AVANT que les
  // routes ne les voient. Barrière globale, en plus des conversions
  // explicites faites dans les services.
  app.use(stripOperators);

  // Routes exemptées de la limite GLOBALE. Elles ne sont pas pour
  // autant sans limite : chacune a la sienne, adaptée à son usage.
  //
  // 1. La notification de paiement. Le prestataire rejoue sa
  //    notification jusqu'à obtenir un 200 ; lui répondre 429
  //    l'arrêterait, et le don resterait « en attente » alors que
  //    l'argent a été prélevé. Elle est protégée par sa signature
  //    HMAC, qui rend toute requête non signée sans effet.
  //
  // 2. Le badgeage des présences. La limite globale compte 300
  //    requêtes par quart d'heure et PAR ADRESSE IP — or tous les
  //    téléphones des agents sortent sur l'unique IP publique du wifi
  //    de l'église, donc partagent ce quota. Un seul agent qui badge
  //    200 membres en un quart d'heure en consomme déjà 260 ; deux
  //    agents dépassent le plafond et se font renvoyer à l'écran de
  //    connexion en pleine file d'attente. Ces routes ont leurs
  //    propres limites (voir rateLimit.js : presenceLoginLimiter pour
  //    la connexion, presenceScanLimiter pour le scan), calibrées sur
  //    le geste réel d'un agent.
  const GLOBAL_LIMIT_EXEMPT = [
    "/api/donations/webhook",
    "/api/presences",
  ];

  const isExemptFromGlobalLimit = (path) =>
    GLOBAL_LIMIT_EXEMPT.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    );

  app.use((req, res, next) =>
    isExemptFromGlobalLimit(req.path)
      ? next()
      : globalLimiter(req, res, next)
  );

  app.use("/api", buildRoutes());

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
