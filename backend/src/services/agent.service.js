import Member from "../models/Member.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { normalizeRegistrationNumber } from "./registrationNumber.service.js";

// Gestion des comptes "agents" du module Nouvelles Âmes ET du Service
// Social — SOA, CANA, coordonnateur des bergeries, pasteur, social_admin,
// social_agent, social_approver, social_viewer. Volontairement séparé de
// tout CRUD générique : ce service ne touche JAMAIS un compte `admin` ou
// `editor`, pour qu'un accès pensé pour gérer des agents de terrain ne
// puisse pas, même par erreur, modifier ou supprimer un compte
// d'administration.
//
// Distinct du `AGENT_ROLES` frontend (src/routes/roleGroups.js), qui ne
// sert qu'à filtrer la navigation Nouvelles Âmes — ne pas confondre les
// deux malgré le nom identique.
export const AGENT_ROLES = [
  "soa",
  "cana",
  "coordinateur_bergeries",
  "pasteur",
  "social_admin",
  "social_agent",
  "social_approver",
  "social_viewer",
];

const publicAgent = (user) => ({
  id: String(user._id),
  name: user.name,
  registrationNumber: user.registrationNumber,
  role: user.role,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

const assertAgentRole = (role) => {
  if (!AGENT_ROLES.includes(role)) {
    throw ApiError.badRequest(
      "Rôle invalide : un agent doit être soa, cana, coordinateur_bergeries, pasteur, social_admin, social_agent, social_approver ou social_viewer."
    );
  }
};

// Un agent se connecte par matricule (voir User.js) : il doit
// correspondre à un membre réellement enregistré, pas être un
// identifiant inventé au clavier — ni une simple coïncidence de forme.
const assertMemberExists = async (registrationNumber) => {
  const normalized = normalizeRegistrationNumber(registrationNumber);

  if (!normalized) {
    throw ApiError.unprocessable("Le matricule est obligatoire.", {
      registrationNumber: "Indiquez le matricule du membre.",
    });
  }

  const member = await Member.findOne({
    registrationNumber: normalized,
  }).select("_id");

  if (!member) {
    throw ApiError.unprocessable(
      "Aucun membre trouvé avec ce matricule.",
      {
        registrationNumber:
          "Vérifiez le matricule, ou enregistrez d'abord ce membre.",
      }
    );
  }

  return normalized;
};

// Ne charge et n'agit QUE sur des comptes déjà "agent" : un compte
// admin/editor est invisible pour ce service, quel que soit l'appel
// (update, désactivation, réinitialisation, suppression).
const loadAgentOrThrow = async (id) => {
  const user = await User.findOne({ _id: id, role: { $in: AGENT_ROLES } });

  if (!user) throw ApiError.notFound("Agent introuvable.");

  return user;
};

export const list = async ({ role, search } = {}) => {
  const filter = { role: { $in: AGENT_ROLES } };

  if (role) {
    assertAgentRole(role);
    filter.role = role;
  }

  if (search) {
    const regex = new RegExp(search.trim(), "i");

    filter.$or = [{ name: regex }, { registrationNumber: regex }];
  }

  const users = await User.find(filter).sort({ name: 1 }).lean();

  return users.map(publicAgent);
};

export const create = async ({ name, registrationNumber, password, role }) => {
  assertAgentRole(role);

  if (!name || !password) {
    throw ApiError.badRequest("Nom et mot de passe sont requis.");
  }

  const normalized = await assertMemberExists(registrationNumber);

  try {
    const user = await User.create({
      name,
      registrationNumber: normalized,
      password,
      role,
    });

    return publicAgent(user);
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict("Un compte existe déjà avec ce matricule.");
    }

    if (error.name === "ValidationError") {
      throw ApiError.unprocessable(
        Object.values(error.errors)[0]?.message ?? "Données invalides."
      );
    }

    throw error;
  }
};

export const update = async (id, { name, registrationNumber, role }) => {
  const user = await loadAgentOrThrow(id);

  if (name !== undefined) user.name = name;

  if (registrationNumber !== undefined) {
    user.registrationNumber = await assertMemberExists(registrationNumber);
  }

  // Un agent ne peut être reclassé que vers un AUTRE rôle agent —
  // jamais promu admin/editor par ce même formulaire.
  if (role !== undefined) {
    assertAgentRole(role);
    user.role = role;
  }

  try {
    await user.save();
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict("Un compte existe déjà avec ce matricule.");
    }

    if (error.name === "ValidationError") {
      throw ApiError.unprocessable(
        Object.values(error.errors)[0]?.message ?? "Données invalides."
      );
    }

    throw error;
  }

  return publicAgent(user);
};

export const setActive = async (id, isActive) => {
  const user = await loadAgentOrThrow(id);

  user.isActive = Boolean(isActive);

  await user.save();

  return publicAgent(user);
};

export const resetPassword = async (id, password) => {
  if (!password) {
    throw ApiError.badRequest("Le nouveau mot de passe est requis.");
  }

  const user = await loadAgentOrThrow(id);

  user.password = password;

  try {
    await user.save();
  } catch (error) {
    if (error.name === "ValidationError") {
      throw ApiError.unprocessable(
        Object.values(error.errors)[0]?.message ?? "Mot de passe invalide."
      );
    }

    throw error;
  }

  return publicAgent(user);
};

export const remove = async (id, requestingUserId) => {
  if (String(id) === String(requestingUserId)) {
    throw ApiError.badRequest("Vous ne pouvez pas supprimer votre propre compte.");
  }

  const user = await loadAgentOrThrow(id);

  await user.deleteOne();
};
