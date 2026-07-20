import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { signToken } from "../middlewares/auth.js";

// Message unique pour tout échec de connexion.
//
// Ne JAMAIS distinguer « compte inconnu » de « mot de passe
// incorrect » : la différence permet d'énumérer les adresses
// e-mail valides, première étape d'une attaque ciblée.
const INVALID = "Identifiants incorrects.";

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
  }).select("+password +failedLoginAttempts +lockedUntil");

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

  await user.registerSuccessfulLogin();

  return {
    token: signToken(user),
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
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
