import rateLimit from "express-rate-limit";

// Limitation de débit.
//
// Trois niveaux, du plus permissif au plus strict. Les routes
// sensibles ne se contentent pas de la limite globale : une attaque
// par force brute sur la connexion tient largement dans le quota
// général.

const handler = (_req, res) => {
  res.status(429).json({
    success: false,
    message:
      "Trop de requêtes. Merci de patienter avant de réessayer.",
    error: { status: 429 },
  });
};

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  handler,
};

// Trafic général de l'API.
export const globalLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 300,
});

// Connexion : protège contre la force brute sur les mots de passe.
// `skipSuccessfulRequests` évite de pénaliser un administrateur qui
// se connecte légitimement plusieurs fois.
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
      error: { status: 429 },
    });
  },
});

// Formulaire de contact : seule route publique en écriture, donc la
// plus exposée au spam.
export const contactLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Vous avez envoyé plusieurs messages récemment. Merci de patienter avant d'en envoyer un nouveau.",
      error: { status: 429 },
    });
  },
});
