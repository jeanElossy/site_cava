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

// Initiation d'un don.
//
// Plus permissif que le formulaire de contact : un donateur qui se
// trompe de moyen de paiement, abandonne puis recommence est un cas
// normal, et le bloquer reviendrait à refuser de l'argent. Assez
// strict, en revanche, pour qu'on ne puisse pas ouvrir des centaines
// de guichets de paiement à la chaîne sur notre compte marchand.
export const donationLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 15,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Plusieurs tentatives de don viennent d'être lancées. Merci de patienter quelques minutes.",
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

// Inscriptions et mises à jour de fiche membre.
//
// Même fenêtre que le formulaire de contact : c'est l'autre seule
// écriture publique de l'API, avec le même risque de spam.
export const submissionLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Vous avez envoyé plusieurs demandes récemment. Merci de patienter avant d'en envoyer une nouvelle.",
      error: { status: 429 },
    });
  },
});

// Recherche d'un membre existant par matricule + nom, pour
// pré-remplir le formulaire.
//
// Plafond volontairement bas et fenêtre longue : un matricule est un
// identifiant séquentiel sur 3 chiffres (voir
// registrationNumber.service.js), donc partiellement devinable. Cette
// route est le seul point d'entrée qui pourrait servir à parcourir
// les ~999 matricules d'une église pour collecter des noms au hasard
// — la limiter sévèrement, en plus de l'exigence du nom exact déjà
// posée par le service, ferme cette porte.
export const lookupLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Trop de tentatives de recherche. Merci de patienter avant de réessayer, ou continuez à remplir le formulaire manuellement.",
      error: { status: 429 },
    });
  },
});

// Signature d'envoi de photo pour le formulaire public d'inscription.
//
// Seule route de signature Cloudinary accessible SANS authentification
// (voir upload.service.js : « il faut d'abord être authentifié sur
// notre API » ne s'applique qu'aux routes /admin/uploads/*). Le
// service restreint cette route à un unique dossier (« members »), et
// cette limite en plus empêche un visiteur d'en faire un générateur de
// signatures à volonté.
export const publicUploadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 15,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Trop d'envois de photo récemment. Merci de patienter avant de réessayer.",
      error: { status: 429 },
    });
  },
});

// Connexion agent au badgeage (QR de sécurité + matricule).
//
// Le matricule est un identifiant séquentiel partiellement devinable
// (voir `lookupLimiter` ci-dessus pour le même raisonnement) : sans
// cette limite, quelqu'un en possession d'un QR de sécurité valide
// pourrait essayer des matricules au hasard jusqu'à en trouver un
// habilité au badgeage.
export const presenceLoginLimiter = rateLimit({
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

// Scan, recherche et saisie pendant une session de badgeage déjà
// authentifiée.
//
// TOUT COMPTEUR EST PAR ADRESSE IP, et c'est ce qui dimensionne cette
// limite : les téléphones de TOUS les agents d'un même site sortent
// sur l'unique IP publique du wifi de l'église. Le plafond n'est donc
// pas « par agent » mais « pour toute l'équipe de badgeage réunie ».
//
// L'ancienne valeur de 60/minute correspondait à un seul agent
// scannant une carte par seconde : deux agents à l'entrée d'un culte
// la dépassaient, et se faisaient renvoyer à l'écran de connexion en
// pleine file d'attente.
//
// 600/minute laisse une marge confortable à une dizaine d'agents
// scannant sans interruption, tout en bornant l'abus d'une session
// volée ou scriptée — la seule chose que cette limite ait à faire ici,
// l'authentification étant déjà exigée en amont.
export const presenceScanLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 600,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Trop de scans en peu de temps. Merci de patienter un instant.",
      error: { status: 429 },
    });
  },
});

// Lectures de l'écran de badgeage : compteurs, liste des visiteurs,
// documents PDF. Sans elle, ces routes n'auraient AUCUNE limite depuis
// que le préfixe `/api/presences` est exempté du plafond global (voir
// app.js) — une exemption ne doit jamais laisser une route nue.
//
// Même raisonnement par IP que ci-dessus. La liste des visiteurs est
// rechargée périodiquement par chaque appareil connecté ; 240/minute
// couvre largement une équipe entière, y compris les PDF générés en
// fin de service.
export const presenceReadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 240,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Trop de requêtes. Merci de patienter un instant.",
      error: { status: 429 },
    });
  },
});
