import mongoose from "mongoose";

import MonitorAssignment from "../models/MonitorAssignment.js";
import MonitorSubstitution from "../models/MonitorSubstitution.js";
import SundaySchoolClass from "../models/SundaySchoolClass.js";
import Member from "../models/Member.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { isSubstitutionActiveAt } from "../utils/substitutionWindow.js";
import { normalizeRegistrationNumber } from "./registrationNumber.service.js";

// Affectations des moniteurs, et surtout : QUELLES CLASSES un moniteur
// a le droit de voir, à un instant donné.

// ------------------------------------------------------------------
// POINT DE DÉCISION UNIQUE
// ------------------------------------------------------------------
// `resolveMonitorAccess` est la SEULE fonction du projet qui décide
// des classes accessibles à un moniteur. Le middleware l'appelle, la
// route « mes classes » l'appelle, l'appel des présences l'appelle.
//
// Ce n'est pas une coquetterie d'architecture. Le badgeage des
// présences a déjà connu le défaut inverse : trois endroits décidaient
// séparément si un membre était agent habilité, ils ont divergé, et la
// connexion passait pendant que chaque requête suivante échouait
// ensuite. Une décision, une fonction.
//
// L'expiration d'un remplacement est CALCULÉE ici, à chaque appel
// (voir utils/substitutionWindow.js) : aucun job n'a besoin d'être
// passé pour qu'un accès s'éteigne, et il ne peut donc pas « ne pas
// avoir tourné ».
export const resolveMonitorAccess = async (memberId, { at = new Date() } = {}) => {
  if (!memberId || !mongoose.isValidObjectId(memberId)) {
    return { assignment: null, primaryClassIds: [], substitutions: [], classIds: [] };
  }

  const assignment = await MonitorAssignment.findOne({
    member: memberId,
    // Une fonction suspendue ou retirée n'ouvre plus rien — y compris
    // sur la classe principale. C'est ce qui permet de mettre un
    // moniteur en retrait sans toucher ni à son compte ni à sa fiche.
    status: "active",
  })
    .populate("primaryClass", "name church status icon room")
    .lean();

  // Classe principale : accès permanent, tant que la classe elle-même
  // n'est pas archivée.
  const primaryClassIds =
    assignment?.primaryClass && assignment.primaryClass.status !== "archived"
      ? [String(assignment.primaryClass._id)]
      : [];

  // Remplacements : on charge tous les `valide` du moniteur, puis on
  // filtre EN MÉMOIRE avec la fonction pure.
  //
  // Pourquoi ne pas filtrer dans la requête Mongo ? Parce que le mode
  // « sessions » porte des jours ÉPARS (30/08, 06/09, 13/09) : un
  // filtre par intervalle couvrirait aussi le 02/09, qui n'a pas été
  // coché. Le volume est de toute façon minuscule — un moniteur a
  // quelques remplacements, pas des milliers.
  const candidates = await MonitorSubstitution.find({
    monitor: memberId,
    status: "valide",
  })
    .populate("class", "name church status icon room")
    .populate("replacedMonitor", "firstName lastName")
    .lean();

  const substitutions = candidates.filter(
    (substitution) =>
      isSubstitutionActiveAt(substitution, at) &&
      substitution.class &&
      substitution.class.status !== "archived"
  );

  const substitutionClassIds = substitutions.map((substitution) =>
    String(substitution.class._id)
  );

  return {
    assignment,
    primaryClassIds,
    substitutions,
    // Ensemble des classes accessibles MAINTENANT. Dédoublonné : un
    // moniteur peut, par erreur de saisie, avoir un remplacement sur
    // sa propre classe principale.
    classIds: [...new Set([...primaryClassIds, ...substitutionClassIds])],
  };
};

// Ce moniteur peut-il agir sur CETTE classe, à CET instant ?
//
// Renvoie le contexte plutôt qu'un simple booléen : l'appelant a
// besoin de savoir SI l'accès vient d'un remplacement, pour l'inscrire
// dans la présence enregistrée (voir ChildAttendance.substitution).
export const resolveClassAccess = async (memberId, classId, { at = new Date() } = {}) => {
  const access = await resolveMonitorAccess(memberId, { at });

  const target = String(classId);

  if (!access.classIds.includes(target)) {
    return { allowed: false, via: null, substitution: null, access };
  }

  const substitution =
    access.substitutions.find((item) => String(item.class._id) === target) ?? null;

  // La classe principale l'emporte : si un moniteur a par ailleurs un
  // remplacement sur sa propre classe, la présence ne doit pas être
  // marquée comme prise « en remplacement ».
  const viaPrimary = access.primaryClassIds.includes(target);

  return {
    allowed: true,
    via: viaPrimary ? "principale" : "remplacement",
    substitution: viaPrimary ? null : substitution,
    access,
  };
};

// ------------------------------------------------------------------
// Affectations — administration
// ------------------------------------------------------------------

const publicAssignment = (assignment) => ({
  id: String(assignment._id),
  member: assignment.member,
  account: assignment.account ? String(assignment.account) : null,
  primaryClass: assignment.primaryClass,
  church: assignment.church,
  level: assignment.level,
  status: assignment.status,
  assignedAt: assignment.assignedAt,
});

export const list = async ({ church, classId, status, search } = {}) => {
  const filter = {};

  if (church) filter.church = church;
  if (classId) filter.primaryClass = classId;
  if (status) filter.status = status;

  const assignments = await MonitorAssignment.find(filter)
    .populate("member", "firstName lastName registrationNumber photo phone role")
    .populate("primaryClass", "name icon room church")
    .sort({ status: 1, createdAt: -1 })
    .lean();

  // La recherche porte sur le NOM du membre, qui vit dans une autre
  // collection : filtrée après jointure plutôt que par une agrégation.
  // Une École du dimanche compte des dizaines de moniteurs, pas des
  // dizaines de milliers — l'agrégation serait du zèle coûteux.
  if (!search) return assignments;

  const needle = String(search).trim().toLowerCase();

  return assignments.filter((assignment) => {
    const member = assignment.member;

    if (!member) return false;

    return (
      `${member.firstName} ${member.lastName}`.toLowerCase().includes(needle) ||
      String(member.registrationNumber ?? "").toLowerCase().includes(needle)
    );
  });
};

// Attribue la fonction de moniteur à un MEMBRE EXISTANT.
//
// Ne crée jamais de membre : c'est la règle fondamentale du module.
// L'écran d'administration ne propose d'ailleurs qu'une recherche
// parmi les membres déjà enregistrés — mais la règle est vérifiée ici
// aussi, parce qu'une interface n'est pas une garantie.
export const assign = async ({ memberId, classId, level, notes }, user) => {
  const member = await Member.findById(memberId).lean();

  if (!member) {
    throw ApiError.unprocessable("Aucun membre trouvé.", {
      memberId: "Choisissez un membre déjà enregistré dans l'annuaire.",
    });
  }

  if (member.status !== "actif") {
    throw ApiError.unprocessable(
      "Ce membre est inactif : réactivez sa fiche avant de lui confier une classe.",
      { memberId: "Membre inactif." }
    );
  }

  const target = await SundaySchoolClass.findById(classId).lean();

  if (!target || target.status === "archived") {
    throw ApiError.unprocessable("Classe introuvable ou archivée.", {
      classId: "Choisissez une classe active.",
    });
  }

  // Un moniteur n'encadre qu'une classe à titre permanent. Encadrer
  // une seconde classe passe par un remplacement, jamais par une
  // seconde affectation — c'est ce qui garantit qu'un accès temporaire
  // reste temporaire.
  const existing = await MonitorAssignment.findOne({ member: memberId });

  if (existing && existing.status !== "retiree") {
    throw ApiError.conflict(
      "Ce membre est déjà moniteur. Modifiez sa classe principale, ou créez un remplacement pour une seconde classe."
    );
  }

  // Une affectation retirée est REPRISE plutôt que dupliquée : l'index
  // unique sur `member` l'imposerait de toute façon, et l'historique
  // (date de première affectation, compte lié) reste ainsi attaché à
  // la personne.
  const document = existing ?? new MonitorAssignment({ member: memberId });

  document.primaryClass = target._id;
  document.church = target.church;
  document.level = level ?? "principal";
  document.status = "active";
  document.assignedAt = new Date();

  if (notes !== undefined) document.notes = notes;
  if (!document.createdBy && user) document.createdBy = user.id;

  // Le membre a peut-être déjà un compte (agent SOA, Service Social) :
  // on le rattache plutôt que d'en créer un second. Le compte moniteur
  // proprement dit se crée séparément (monitorAccount.service.js), et
  // seulement si l'administrateur ouvre l'accès.
  if (!document.account && member.registrationNumber) {
    const account = await User.findOne({
      registrationNumber: member.registrationNumber,
    })
      .select("_id")
      .lean();

    if (account) document.account = account._id;
  }

  await document.save();

  return publicAssignment(document.toObject());
};

export const update = async (id, { classId, level, status, notes }) => {
  const assignment = await MonitorAssignment.findById(id);

  if (!assignment) throw ApiError.notFound("Affectation introuvable.");

  if (classId !== undefined) {
    const target = await SundaySchoolClass.findById(classId).lean();

    if (!target || target.status === "archived") {
      throw ApiError.unprocessable("Classe introuvable ou archivée.", {
        classId: "Choisissez une classe active.",
      });
    }

    assignment.primaryClass = target._id;
    assignment.church = target.church;
  }

  if (level !== undefined) assignment.level = level;
  if (status !== undefined) assignment.status = status;
  if (notes !== undefined) assignment.notes = notes;

  await assignment.save();

  return publicAssignment(assignment.toObject());
};

// Retirer la fonction NE TOUCHE NI au compte NI à la fiche membre.
//
// Trois objets, trois cycles de vie (voir MonitorAssignment.js). Le
// cahier des charges est explicite : « la désactivation du compte
// moniteur ne doit pas supprimer le membre adulte ».
export const withdraw = async (id) => {
  const assignment = await MonitorAssignment.findById(id);

  if (!assignment) throw ApiError.notFound("Affectation introuvable.");

  assignment.status = "retiree";

  await assignment.save();

  return publicAssignment(assignment.toObject());
};

// Retrouve l'affectation à partir d'un COMPTE connecté.
//
// Le compte porte le matricule, le matricule identifie le membre, et
// c'est le membre qui porte la fonction. Ce chemin en trois temps est
// la conséquence directe du choix de ne jamais dupliquer l'identité —
// il est centralisé ici pour n'exister qu'une fois.
export const findMemberForAccount = async (user) => {
  const registrationNumber = normalizeRegistrationNumber(user?.registrationNumber);

  if (!registrationNumber) return null;

  return Member.findOne({ registrationNumber }).lean();
};

// Membres que l'on peut nommer moniteur.
//
// ------------------------------------------------------------------
// UNE RECHERCHE CLOISONNÉE, PAS L'ANNUAIRE COMPLET
// ------------------------------------------------------------------
// Nommer un moniteur suppose de retrouver un membre adulte, ce que le
// module Enfants n'avait aucun moyen de faire : l'écran listait les
// affectations existantes sans jamais permettre d'en créer une.
//
// Plutôt que d'ouvrir l'annuaire des membres au responsable de l'École
// du dimanche, cette fonction ne renvoie que les quelques champs
// nécessaires à l'identification, et seulement sur une recherche
// explicite — pas de listing complet à vide.
export const searchAssignableMembers = async ({ search, church, limit = 15 } = {}) => {
  const needle = String(search ?? "").trim();

  // Deux caractères au minimum : sans cela, la première frappe
  // ramènerait un échantillon arbitraire de l'annuaire.
  if (needle.length < 2) return [];

  // Le matricule est stocké sans séparateur (`1ME19016P`) alors que
  // l'utilisateur le lit et le tape espacé (`1ME 19-016 P`). Chercher
  // la chaîne saisie telle quelle ne trouverait jamais rien : on la
  // normalise d'abord, ce qui répare au passage les confusions O/0 et
  // I/1.
  const asRegistration = normalizeRegistrationNumber(needle);

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, "i");

  const filter = {
    status: "actif",
    $or: [
      { firstName: pattern },
      { lastName: pattern },
      { registrationNumber: new RegExp(`^${asRegistration}`, "i") },
    ],
  };

  if (church) filter.church = church;

  const members = await Member.find(filter)
    .select("firstName lastName registrationNumber photo church phone")
    .sort({ lastName: 1, firstName: 1 })
    .limit(Math.min(Math.max(Number(limit) || 15, 1), 50))
    .lean();

  // Les membres DÉJÀ moniteurs sont marqués plutôt que masqués :
  // l'utilisateur qui cherche « Sarah » et ne la voit pas conclurait
  // qu'elle n'est pas dans l'annuaire, alors qu'elle encadre déjà une
  // classe. Le service `assign` refuse de toute façon une seconde
  // affectation.
  const assignments = await MonitorAssignment.find({
    member: { $in: members.map((item) => item._id) },
    status: { $ne: "retiree" },
  })
    .populate("primaryClass", "name")
    .lean();

  const byMember = new Map(
    assignments.map((item) => [String(item.member), item])
  );

  return members.map((member) => {
    const assignment = byMember.get(String(member._id));

    return {
      ...member,
      id: String(member._id),
      alreadyMonitor: Boolean(assignment),
      currentClassName: assignment?.primaryClass?.name ?? null,
    };
  });
};
