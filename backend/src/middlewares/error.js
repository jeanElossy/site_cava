import mongoose from "mongoose";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

// Route inconnue : 404 explicite plutôt que le HTML par défaut d'Express.
export const notFound = (req, _res, next) => {
  next(
    ApiError.notFound(
      `Route inconnue : ${req.method} ${req.originalUrl}`
    )
  );
};

// Traduit les erreurs Mongoose en erreurs applicatives lisibles.
const translate = (err) => {
  if (err instanceof ApiError) return err;

  // Validation de schéma → 422 avec le détail par champ, pour que le
  // front puisse afficher chaque message sous le bon input.
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(
      Object.entries(err.errors).map(([field, e]) => [
        field,
        e.message,
      ])
    );

    return ApiError.unprocessable(
      "Les données envoyées sont invalides.",
      details
    );
  }

  // Identifiant mal formé → 400 plutôt qu'une erreur serveur.
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest("Identifiant invalide.");
  }

  // Violation d'index unique.
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0];

    return ApiError.conflict(
      field
        ? `Cette valeur de « ${field} » est déjà utilisée.`
        : "Cette ressource existe déjà."
    );
  }

  // JSON malformé dans le corps de la requête.
  if (err?.type === "entity.parse.failed") {
    return ApiError.badRequest("Corps de requête JSON invalide.");
  }

  return null;
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const known = translate(err);

  const status = known?.status ?? 500;

  // RÈGLE : on ne renvoie au client que les messages écrits pour lui.
  // Une exception interne (bug, panne base) devient un message
  // générique — sa stack ou son texte pourraient révéler la structure
  // du code, des chemins de fichiers ou des noms de collections.
  const message = known
    ? known.message
    : "Une erreur interne est survenue.";

  if (!known || status >= 500) {
    console.error(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`,
      err
    );
  }

  const body = {
    success: false,
    message,
    error: { status },
  };

  if (known?.details) body.error.details = known.details;

  // La stack n'est exposée qu'en développement, jamais en production.
  if (!env.isProduction && !known) {
    body.error.stack = err?.stack;
  }

  res.status(status).json(body);
};
