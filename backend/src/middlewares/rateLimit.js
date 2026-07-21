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

// Vérification du second facteur.
//
// Un code à 6 chiffres, c'est un million de combinaisons — mais la
// fenêtre de tolérance en accepte trois à la fois, ce qui ramène la
// probabilité d'un tirage au hasard à environ 1 sur 333 000. Sans
// plafond, une machine épuiserait cet espace en quelques heures.
//
// La limite est plus basse que celle de la connexion : à ce stade,
// l'utilisateur légitime lit un code affiché sur son téléphone et n'a
// aucune raison de se tromper dix fois. Le verrouillage de compte
// (5 échecs → 15 minutes) prend le relais pour les attaques
// distribuées, que le comptage par adresse IP ne voit pas.
export const twoFactorLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Trop de codes incorrects. Réessayez dans quelques minutes.",
      error: { status: 429 },
    });
  },
});

// Gestion du second facteur depuis l'espace connecté (installation,
// activation, désactivation, régénération des codes).
//
// Compteur DISTINCT de celui de la connexion, et c'est le point
// important : partager le quota reviendrait à ce que des tentatives de
// connexion ratées empêchent ensuite l'administrateur de configurer sa
// propre 2FA — une panne créée par la protection elle-même.
//
// Plafond plus haut car la route exige déjà un jeton de session
// valide : l'attaquant anonyme n'y accède pas. La limite ne sert qu'à
// borner l'abus d'un compte déjà compromis.
export const twoFactorManageLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Trop de tentatives. Réessayez dans quelques minutes.",
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
