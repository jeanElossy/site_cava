// Erreur applicative portant son code HTTP.
//
// Les services lèvent des `ApiError` ; le middleware d'erreur global les
// traduit en réponse. Aucune couche n'a besoin de connaître Express pour
// signaler « introuvable » ou « interdit ».
//
// `details` reste volontairement structuré (objet champ → raison) pour
// que le front puisse afficher l'erreur au bon endroit d'un formulaire.
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.details = details;

    // Marque l'erreur comme sûre à renvoyer au client : elle a été
    // rédigée pour lui, contrairement à une exception interne.
    this.expose = true;
  }

  static badRequest(message = "Requête invalide.", details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Authentification requise.", details) {
    return new ApiError(401, message, details);
  }

  static forbidden(message = "Accès refusé.", details) {
    return new ApiError(403, message, details);
  }

  static notFound(message = "Ressource introuvable.", details) {
    return new ApiError(404, message, details);
  }

  static conflict(message = "Cette ressource existe déjà.", details) {
    return new ApiError(409, message, details);
  }

  static unprocessable(message = "Les données envoyées sont invalides.", details) {
    return new ApiError(422, message, details);
  }

  static tooManyRequests(message = "Trop de requêtes. Réessayez plus tard.", details) {
    return new ApiError(429, message, details);
  }
}
