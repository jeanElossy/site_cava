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

  // La notification de paiement échappe à la limite globale.
  //
  // Le prestataire rejoue sa notification jusqu'à obtenir un 200 ; lui
  // répondre 429 l'arrêterait, et le don resterait « en attente » alors
  // que l'argent a été prélevé. La route est protégée autrement : par
  // la signature HMAC, qui rend toute requête non signée sans effet.
  app.use((req, res, next) =>
    req.path === "/api/donations/webhook"
      ? next()
      : globalLimiter(req, res, next)
  );

  app.use("/api", buildRoutes());

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
