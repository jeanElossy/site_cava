import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import {
  signToken,
  signChallengeToken,
  verifyChallengeToken,
} from "../middlewares/auth.js";
import {
  generateSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  otpauthURL,
  verifyTotp,
} from "../utils/totp.js";

// Message unique pour tout échec de connexion.
//
// Ne JAMAIS distinguer « compte inconnu » de « mot de passe
// incorrect » : la différence permet d'énumérer les adresses
// e-mail valides, première étape d'une attaque ciblée.
const INVALID = "Identifiants incorrects.";

const INVALID_CODE =
  "Code de vérification incorrect ou expiré.";

// Nom affiché dans l'application d'authentification du téléphone.
const ISSUER = "CAVA — Administration";

// Représentation publique d'un compte. Centralisée pour qu'aucune
// route ne renvoie par mégarde un champ sensible.
const publicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  twoFactorEnabled: Boolean(user.twoFactor?.enabled),
});

// Charge un compte avec tout ce que la 2FA nécessite. Ces champs sont
// `select: false` dans le modèle : il faut les demander explicitement.
const loadWithSecrets = (id) =>
  User.findById(id).select(
    "+password +twoFactor.secret +twoFactor.pendingSecret +twoFactor.lastUsedStep +twoFactor.recoveryCodes +failedLoginAttempts +lockedUntil"
  );

export const login = async ({ email, password }) => {
  if (!email || !password) {
    throw ApiError.badRequest(
      "E-mail et mot de passe sont requis." 
    );
  }

  // `select('+...')` : hash et compteurs de verrouillage sont exclus
  // par défaut au niveau du modèle, il faut les demander ici.
  const user = await User.findOne({
    email: String(email).toLowerCase().trim(),
  }).select(
    "+password +failedLoginAttempts +lockedUntil +twoFactor.secret"
  );

  // Compte inexistant ou désactivé : même réponse qu'un mot de passe
  // faux, pour ne pas révéler quelles adresses existent.
  if (!user || !user.isActive) {
    throw ApiError.unauthorized(INVALID);
  }

  // Compte verrouillé : on le dit explicitement. Contrairement à
  // l'existence d'un compte, cette information n'aide pas un
  // attaquant — elle lui apprend seulement que sa tentative a
  // échoué — et son absence laisserait le titulaire légitime sans
  // explication devant des rejets répétés.
  if (user.isLocked()) {
    const minutes = Math.ceil(
      (user.lockedUntil - Date.now()) / 60000
    );

    throw ApiError.unauthorized(
      `Compte temporairement verrouillé après plusieurs tentatives. Réessayez dans ${minutes} minute(s).`
    );
  }

  const ok = await user.comparePassword(String(password));

  if (!ok) {
    await user.registerFailedLogin();

    throw ApiError.unauthorized(INVALID);
  }

  // Le mot de passe est bon. Si un second facteur est actif, la
  // connexion s'arrête ICI : pas de jeton de session, seulement une
  // preuve à durée de vie courte que cette étape a été franchie.
  //
  // Le compteur d'échecs n'est PAS remis à zéro tant que le second
  // facteur n'a pas été validé : sinon, un attaquant en possession du
  // mot de passe pourrait le réinitialiser indéfiniment et ne jamais
  // déclencher le verrouillage du compte.
  if (user.twoFactor?.enabled && user.twoFactor?.secret) {
    return {
      twoFactorRequired: true,
      challengeToken: signChallengeToken(user),
    };
  }

  await user.registerSuccessfulLogin();

  return {
    token: signToken(user),
    user: publicUser(user),
  };
};

// ------------------------------------------------------------------
// Seconde étape de connexion
// ------------------------------------------------------------------

export const verifyLoginTwoFactor = async ({
  challengeToken,
  code,
}) => {
  const payload = verifyChallengeToken(challengeToken);

  if (!payload) {
    throw ApiError.unauthorized(
      "Vérification expirée. Reprenez la connexion depuis le début."
    );
  }

  const user = await loadWithSecrets(payload.sub);

  if (
    !user ||
    !user.isActive ||
    !user.twoFactor?.enabled ||
    !user.twoFactor?.secret
  ) {
    throw ApiError.unauthorized(INVALID);
  }

  if (user.isLocked()) {
    const minutes = Math.ceil(
      (user.lockedUntil - Date.now()) / 60000
    );

    throw ApiError.unauthorized(
      `Compte temporairement verrouillé. Réessayez dans ${minutes} minute(s).`
    );
  }

  const step = verifyTotp(code, user.twoFactor.secret);

  if (step !== null) {
    // Anti-rejeu : un code reste mathématiquement valide environ 90
    // secondes. Sans ce garde-fou, un code capturé (épaule, capture
    // d'écran, journal mal configuré) resterait utilisable une bonne
    // minute après sa saisie légitime.
    if (
      user.twoFactor.lastUsedStep &&
      step <= user.twoFactor.lastUsedStep
    ) {
      await user.registerFailedLogin();

      throw ApiError.unauthorized(
        "Ce code a déjà été utilisé. Attendez le suivant."
      );
    }

    await User.updateOne(
      { _id: user._id },
      { "twoFactor.lastUsedStep": step }
    );

    await user.registerSuccessfulLogin();

    return { token: signToken(user), user: publicUser(user) };
  }

  // Pas un code TOTP valide : peut-être un code de secours.
  const consumed = await consumeRecoveryCode(user, code);

  if (consumed) {
    await user.registerSuccessfulLogin();

    return {
      token: signToken(user),
      user: publicUser(user),
      recoveryCodeUsed: true,
      recoveryCodesLeft: consumed.remaining,
    };
  }

  await user.registerFailedLogin();

  throw ApiError.unauthorized(INVALID_CODE);
};

// Consomme un code de secours à usage unique. Renvoie `null` si le
// code ne correspond à aucun code encore disponible.
const consumeRecoveryCode = async (user, code) => {
  const hash = hashRecoveryCode(code);

  if (hash.length === 0) return null;

  const codes = user.twoFactor?.recoveryCodes ?? [];

  const index = codes.findIndex(
    (entry) => !entry.usedAt && entry.codeHash === hash
  );

  if (index === -1) return null;

  // Marquage conditionné à l'absence de `usedAt` : deux requêtes
  // simultanées portant le même code n'en valident qu'une.
  const result = await User.updateOne(
    {
      _id: user._id,
      [`twoFactor.recoveryCodes.${index}.usedAt`]: null,
    },
    {
      [`twoFactor.recoveryCodes.${index}.usedAt`]: new Date(),
    }
  );

  if (result.modifiedCount !== 1) return null;

  const remaining = codes.filter(
    (entry, position) => !entry.usedAt && position !== index
  ).length;

  return { remaining };
};

// ------------------------------------------------------------------
// Installation et gestion du second facteur
// ------------------------------------------------------------------

export const twoFactorStatus = async (userId) => {
  const user = await User.findById(userId).select(
    "+twoFactor.recoveryCodes"
  );

  if (!user) throw ApiError.unauthorized("Session invalide.");

  const codes = user.twoFactor?.recoveryCodes ?? [];

  return {
    enabled: Boolean(user.twoFactor?.enabled),
    activatedAt: user.twoFactor?.activatedAt ?? null,
    recoveryCodesLeft: codes.filter((entry) => !entry.usedAt)
      .length,
  };
};

// Étape 1 : produire un secret et le présenter à scanner.
//
// Rien n'est activé à ce stade. Tant que l'utilisateur n'a pas prouvé
// qu'il sait générer un code, activer la 2FA le mettrait dehors de son
// propre espace.
export const startTwoFactorSetup = async (userId) => {
  const user = await User.findById(userId);

  if (!user) throw ApiError.unauthorized("Session invalide.");

  if (user.twoFactor?.enabled) {
    throw ApiError.badRequest(
      "La double authentification est déjà active. Désactivez-la d'abord pour la reconfigurer."
    );
  }

  const secret = generateSecret();

  user.twoFactor.pendingSecret = secret;

  await user.save();

  return {
    secret,
    otpauthUrl: otpauthURL({
      secret,
      account: user.email,
      issuer: ISSUER,
    }),
  };
};

// Étape 2 : l'utilisateur saisit un code issu de son application. S'il
// est correct, le secret passe de « en attente » à « actif ».
export const enableTwoFactor = async (userId, { code }) => {
  const user = await loadWithSecrets(userId);

  if (!user) throw ApiError.unauthorized("Session invalide.");

  if (user.twoFactor?.enabled) {
    throw ApiError.badRequest(
      "La double authentification est déjà active."
    );
  }

  const pending = user.twoFactor?.pendingSecret;

  if (!pending) {
    throw ApiError.badRequest(
      "Aucune configuration en cours. Recommencez l'installation."
    );
  }

  const step = verifyTotp(code, pending);

  if (step === null) {
    throw ApiError.badRequest(
      "Code incorrect. Vérifiez que l'heure de votre téléphone est réglée automatiquement."
    );
  }

  const plainCodes = generateRecoveryCodes();

  user.twoFactor.secret = pending;
  user.twoFactor.pendingSecret = undefined;
  user.twoFactor.enabled = true;
  user.twoFactor.activatedAt = new Date();
  user.twoFactor.lastUsedStep = step;
  user.twoFactor.recoveryCodes = plainCodes.map((value) => ({
    codeHash: hashRecoveryCode(value),
    usedAt: null,
  }));

  await user.save();

  // Seul et unique moment où les codes existent en clair. Ils ne sont
  // stockés que hachés : ni nous ni une fuite de la base ne peuvent
  // les retrouver ensuite.
  return { recoveryCodes: plainCodes };
};

// Désactivation : mot de passe ET code valide.
//
// Exiger les deux n'est pas de la paranoïa. Si un seul suffisait, un
// attaquant ayant obtenu le mot de passe — précisément ce contre quoi
// la 2FA protège — pourrait la retirer et revenir tranquillement.
export const disableTwoFactor = async (
  userId,
  { password, code }
) => {
  const user = await loadWithSecrets(userId);

  if (!user) throw ApiError.unauthorized("Session invalide.");

  if (!user.twoFactor?.enabled) {
    throw ApiError.badRequest(
      "La double authentification n'est pas active."
    );
  }

  if (!password) {
    throw ApiError.badRequest(
      "Votre mot de passe est requis pour cette action."
    );
  }

  if (!(await user.comparePassword(String(password)))) {
    throw ApiError.unauthorized("Mot de passe incorrect.");
  }

  const valid =
    verifyTotp(code, user.twoFactor.secret) !== null ||
    Boolean(await consumeRecoveryCode(user, code));

  if (!valid) {
    throw ApiError.unauthorized(INVALID_CODE);
  }

  user.twoFactor.enabled = false;
  user.twoFactor.secret = undefined;
  user.twoFactor.pendingSecret = undefined;
  user.twoFactor.activatedAt = undefined;
  user.twoFactor.lastUsedStep = undefined;
  user.twoFactor.recoveryCodes = [];

  await user.save();

  return true;
};

// Régénère les codes de secours (par exemple s'il n'en reste plus).
// Les anciens sont invalidés dans le même mouvement.
export const regenerateRecoveryCodes = async (
  userId,
  { password }
) => {
  const user = await loadWithSecrets(userId);

  if (!user) throw ApiError.unauthorized("Session invalide.");

  if (!user.twoFactor?.enabled) {
    throw ApiError.badRequest(
      "La double authentification n'est pas active."
    );
  }

  if (!password || !(await user.comparePassword(String(password)))) {
    throw ApiError.unauthorized("Mot de passe incorrect.");
  }

  const plainCodes = generateRecoveryCodes();

  user.twoFactor.recoveryCodes = plainCodes.map((value) => ({
    codeHash: hashRecoveryCode(value),
    usedAt: null,
  }));

  await user.save();

  return { recoveryCodes: plainCodes };
};

export const changePassword = async (
  userId,
  { currentPassword, newPassword }
) => {
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest(
      "Le mot de passe actuel et le nouveau sont requis."
    );
  }

  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw ApiError.unauthorized("Session invalide.");
  }

  const ok = await user.comparePassword(String(currentPassword));

  if (!ok) {
    throw ApiError.unauthorized(
      "Le mot de passe actuel est incorrect."
    );
  }

  // Le hook `pre('save')` du modèle se charge du hachage.
  user.password = String(newPassword);

  await user.save();

  return true;
};
