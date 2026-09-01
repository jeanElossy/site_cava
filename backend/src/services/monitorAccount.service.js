import crypto from "node:crypto";

import User from "../models/User.js";
import Member from "../models/Member.js";
import MonitorAssignment from "../models/MonitorAssignment.js";
import { ApiError } from "../utils/ApiError.js";
import { normalizeRegistrationNumber } from "./registrationNumber.service.js";

// Comptes de connexion des moniteurs de l'École du dimanche.
//
// ------------------------------------------------------------------
// VOLONTAIREMENT SÉPARÉ DE agent.service.js
// ------------------------------------------------------------------
// Le montage est le même (un `User` dont le `registrationNumber`
// renvoie à un `Member` réel), mais `agent.service.js` ne doit pas
// gérer les moniteurs : son `AGENT_ROLES` pilote `loadAgentOrThrow`, et
// y ajouter « moniteur » ferait apparaître tous les moniteurs dans
// /admin/agents — un écran qui ignore tout des classes, et où l'on
// pourrait donc modifier un moniteur sans voir son affectation.
//
// Symétriquement, ce service ne touche JAMAIS un compte admin, editor
// ou agent : `loadMonitorAccountOrThrow` ne charge que les rôles
// ci-dessous. Deux modules, deux périmètres étanches.
export const MONITOR_ACCOUNT_ROLES = ["moniteur", "responsable_ecole_dimanche"];

// Mot de passe temporaire : 16 caractères d'un alphabet SANS
// caractères ambigus (ni O/0, ni I/l/1).
//
// Ce mot de passe est dicté à voix haute ou recopié sur un papier
// avant d'être saisi sur un téléphone. Un « 0 » qu'on lit « O » produit
// un échec de connexion que personne ne sait expliquer — et trois
// échecs de plus verrouillent le compte quinze minutes.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

// 16 caractères : au-delà du minimum de 12 imposé par le schéma, avec
// de la marge — c'est un mot de passe qui vit quelques minutes.
const TEMPORARY_PASSWORD_LENGTH = 16;

export const generateTemporaryPassword = () => {
  const bytes = crypto.randomBytes(TEMPORARY_PASSWORD_LENGTH);

  let out = "";

  for (let index = 0; index < TEMPORARY_PASSWORD_LENGTH; index += 1) {
    out += ALPHABET[bytes[index] % ALPHABET.length];
  }

  return out;
};

// Représentation publique d'un compte moniteur.
//
// Ne contient JAMAIS le mot de passe, ni son hash (le modèle le met
// déjà en `select: false`, ceci est la seconde barrière). Le mot de
// passe temporaire n'apparaît qu'une seule fois, dans la valeur de
// retour de `openAccess`/`resetPassword` — jamais dans une lecture.
const publicAccount = (user) => ({
  id: String(user._id),
  name: user.name,
  registrationNumber: user.registrationNumber,
  role: user.role,
  isActive: user.isActive,
  // C'est ce drapeau qui dit à l'administration « ce moniteur ne s'est
  // pas encore connecté », sans jamais révéler le mot de passe.
  passwordChangeRequired: Boolean(user.passwordChangeRequired),
  passwordChangedAt: user.passwordChangedAt ?? null,
  lastLoginAt: user.lastLoginAt ?? null,
  church: user.church,
});

// Ne charge QUE des comptes de moniteur : un compte admin, editor ou
// agent est invisible pour ce service, quel que soit l'appel.
const loadMonitorAccountOrThrow = async (id) => {
  const user = await User.findOne({
    _id: id,
    role: { $in: MONITOR_ACCOUNT_ROLES },
  });

  if (!user) throw ApiError.notFound("Compte moniteur introuvable.");

  return user;
};

// Ouvre l'accès à l'espace moniteur pour un membre DÉJÀ affecté.
//
// Trois vérifications, dans cet ordre, et aucune n'est redondante :
//   1. le matricule renvoie à un membre réel (comme agent.service.js) ;
//   2. ce membre a bien la fonction de moniteur — sinon l'accès
//      donnerait vue sur des enfants sans qu'aucune classe ne le
//      justifie ;
//   3. il n'a pas déjà un compte à un AUTRE rôle — auquel cas on
//      refuse plutôt que d'écraser silencieusement un accès existant
//      (un agent SOA qui deviendrait moniteur perdrait son module).
export const openAccess = async ({ memberId, password, role }, actor) => {
  const member = await Member.findById(memberId).lean();

  if (!member) {
    throw ApiError.unprocessable("Membre introuvable.", {
      memberId: "Choisissez un membre enregistré.",
    });
  }

  const registrationNumber = normalizeRegistrationNumber(member.registrationNumber);

  if (!registrationNumber) {
    throw ApiError.unprocessable(
      "Ce membre n'a pas de matricule : il ne peut pas se connecter, le matricule étant l'identifiant de connexion.",
      { memberId: "Attribuez d'abord un matricule à ce membre." }
    );
  }

  const targetRole = role ?? "moniteur";

  if (!MONITOR_ACCOUNT_ROLES.includes(targetRole)) {
    throw ApiError.badRequest(
      "Rôle invalide : un accès École du dimanche est « moniteur » ou « responsable_ecole_dimanche »."
    );
  }

  const assignment = await MonitorAssignment.findOne({
    member: memberId,
    status: "active",
  });

  // Le responsable de l'École du dimanche n'encadre pas forcément une
  // classe : son accès ne dépend donc pas d'une affectation. Le
  // moniteur, lui, n'a de raison d'entrer que s'il a une classe.
  if (targetRole === "moniteur" && !assignment) {
    throw ApiError.unprocessable(
      "Attribuez d'abord une classe à ce membre : un accès moniteur sans classe n'ouvre sur rien.",
      { memberId: "Fonction de moniteur requise." }
    );
  }

  const existing = await User.findOne({ registrationNumber });

  if (existing && !MONITOR_ACCOUNT_ROLES.includes(existing.role)) {
    throw ApiError.conflict(
      `Ce membre a déjà un compte « ${existing.role} ». Modifiez ce compte plutôt que d'en créer un second — un membre n'a jamais deux identités.`
    );
  }

  const temporaryPassword = password || generateTemporaryPassword();

  if (temporaryPassword.length < 12) {
    throw ApiError.unprocessable(
      "Le mot de passe temporaire doit faire au moins 12 caractères.",
      { password: "12 caractères minimum." }
    );
  }

  const account = existing ?? new User({ registrationNumber });

  account.name = `${member.firstName} ${member.lastName}`.trim();
  account.role = targetRole;
  account.password = temporaryPassword;
  // Le cœur du dispositif : le mot de passe posé ici est connu de
  // l'administrateur, il ne peut donc pas rester celui du titulaire.
  account.passwordChangeRequired = true;
  account.passwordChangedAt = undefined;
  account.isActive = true;
  account.church = member.church;

  await account.save();

  if (assignment && !assignment.account) {
    assignment.account = account._id;

    await assignment.save();
  }

  return {
    account: publicAccount(account),
    // SEUL ET UNIQUE moment où ce mot de passe existe en clair hors du
    // navigateur de l'administrateur. Il n'est stocké que haché, n'est
    // jamais journalisé, et aucune lecture ultérieure ne le renvoie —
    // même traitement que les codes de secours de la 2FA.
    temporaryPassword,
    actorId: actor?.id,
  };
};

export const resetPassword = async (id, { password } = {}) => {
  const account = await loadMonitorAccountOrThrow(id);

  const temporaryPassword = password || generateTemporaryPassword();

  if (temporaryPassword.length < 12) {
    throw ApiError.unprocessable(
      "Le mot de passe temporaire doit faire au moins 12 caractères.",
      { password: "12 caractères minimum." }
    );
  }

  account.password = temporaryPassword;
  account.passwordChangeRequired = true;
  account.passwordChangedAt = undefined;

  await account.save();

  // La session en cours du moniteur tombe immédiatement : `requireAuth`
  // refuse tout jeton dont le compte est repassé en mot de passe
  // temporaire. C'est ce qui rend la réinitialisation utile face à un
  // compte que l'on soupçonne compromis — sans elle, l'ancien jeton
  // resterait valide jusqu'à sept jours.
  return { account: publicAccount(account), temporaryPassword };
};

export const setActive = async (id, isActive) => {
  const account = await loadMonitorAccountOrThrow(id);

  account.isActive = Boolean(isActive);

  await account.save();

  return publicAccount(account);
};

// Retire l'ACCÈS, sans toucher ni à la fonction ni au membre.
//
// Le compte est désactivé plutôt que supprimé : le journal d'audit
// référence son identifiant, et une suppression rendrait illisibles
// des traces d'actions qui ont bien eu lieu.
export const revokeAccess = async (id) => {
  const account = await loadMonitorAccountOrThrow(id);

  account.isActive = false;

  await account.save();

  await MonitorAssignment.updateMany(
    { account: account._id },
    { $unset: { account: "" } }
  );

  return publicAccount(account);
};

export const listAccounts = async ({ church } = {}) => {
  const filter = { role: { $in: MONITOR_ACCOUNT_ROLES } };

  if (church) filter.church = church;

  const accounts = await User.find(filter).sort({ name: 1 }).lean();

  return accounts.map(publicAccount);
};
