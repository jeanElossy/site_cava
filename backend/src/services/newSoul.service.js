import NewSoul, {
  NEW_SOUL_STATUSES,
  SOA_EDITABLE_STATUSES,
} from "../models/NewSoul.js";
import Member from "../models/Member.js";
import Flock from "../models/Flock.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { nextCaseNumber } from "./newSoulNumber.service.js";
import { nextRegistrationNumber } from "./registrationNumber.service.js";

// Rôles ADMIN (jamais un agent de présence) habilités à voir TOUS les
// dossiers déjà transmis (jamais ceux encore en cours de saisie par
// le SOA, qui n'existent pas encore pour la CANA).
const CANA_SIDE_ROLES = ["cana", "coordinateur_bergeries", "pasteur", "admin"];

// Sous-ensemble de `cana.*` que le coordonnateur des bergeries peut
// modifier (appels, visites, préparation à l'intégration) — le
// diagnostic spirituel, l'entretien et la clôture restent réservés à
// la CANA/admin. Voir le tableau de rôles du design validé.
const COORDINATEUR_WRITABLE_FIELDS = new Set([
  "monthlyFollowUps",
  "plan",
  "checkpoints",
  "flock",
  "flockReason",
  "shepherd",
  "flockDecisionDate",
  "flockTransmissionDate",
  "flockContactDate",
  "flockFirstParticipationDate",
]);

// Jamais modifiable par une requête PATCH générique : posé uniquement
// par les actions dédiées (`transmit`, `acknowledge`, `close`).
const CANA_SYSTEM_FIELDS = new Set([
  "acknowledgedAt",
  "acknowledgedBy",
  "closedAt",
  "closedByCoordinateur",
  "closedByResponsable",
]);
const SOA_SYSTEM_FIELDS = new Set(["transmittedAt", "transmittedBy", "lockedAt"]);

// --- Identité de l'auteur (`actor`, voir middlewares/newSoulAuth.js) -
//
// Deux origines possibles : un compte admin (`kind: "user"`, rôles
// soa/cana/coordinateur_bergeries/pasteur/admin) ou un agent de
// badgeage des présences (`kind: "member"`, n'importe quel rôle
// habilité à scanner — voir PRESENCE_AGENT_ROLES). Un agent de
// présence a exactement les mêmes droits qu'un compte "soa" : créer,
// compléter et transmettre SES PROPRES dossiers, jamais ceux des
// autres, jamais le côté CANA.
const isAdminUser = (actor) => actor.kind === "user" && actor.role === "admin";
const isSoaCapable = (actor) =>
  actor.kind === "member" || (actor.kind === "user" && actor.role === "soa");
const isCanaSideUser = (actor) => actor.kind === "user" && CANA_SIDE_ROLES.includes(actor.role);

const toAuthor = (actor) => ({ kind: actor.kind, id: actor.id, name: actor.name });

const ownsRecord = (newSoul, actor) =>
  newSoul.createdBy?.kind === actor.kind && String(newSoul.createdBy?.id) === String(actor.id);

const applyStatus = (doc, status, actor, note) => {
  doc.status = status;
  doc.statusHistory.push({ status, changedBy: toAuthor(actor), note });
};

// La note confidentielle de délivrance (§L.4) ne doit jamais atteindre
// soa/coordinateur_bergeries, même en lecture — filtrée ici plutôt que
// de compter sur chaque appelant pour l'omettre.
const stripConfidentialFields = (newSoul, actor) => {
  const plain = newSoul.toObject ? newSoul.toObject() : newSoul;
  const canSeeConfidential = actor.kind === "user" && ["cana", "admin", "pasteur"].includes(actor.role);

  if (!canSeeConfidential) {
    delete plain.cana?.deliveranceConfidentialNotes;
  }

  return plain;
};

const withConfidentialSelect = (query, actor) =>
  actor.kind === "user" && ["cana", "admin", "pasteur"].includes(actor.role)
    ? query.select("+cana.deliveranceConfidentialNotes")
    : query;

export const create = async (data, actor) => {
  const caseNumber = await nextCaseNumber();
  const author = toAuthor(actor);

  const newSoul = new NewSoul({
    caseNumber,
    status: "enregistre_soa",
    createdBy: author,
    soa: {
      ...data,
      agent: author,
    },
  });

  newSoul.statusHistory.push({ status: "enregistre_soa", changedBy: author });

  await newSoul.save();

  return attachDisplayNames(stripConfidentialFields(newSoul, actor));
};

const assertCanView = (newSoul, actor) => {
  if (isAdminUser(actor)) return;

  if (isSoaCapable(actor)) {
    if (!ownsRecord(newSoul, actor)) {
      throw ApiError.forbidden("Vous ne pouvez consulter que vos propres dossiers.");
    }

    return;
  }

  if (isCanaSideUser(actor)) {
    if (SOA_EDITABLE_STATUSES.includes(newSoul.status)) {
      throw ApiError.forbidden("Ce dossier n'a pas encore été transmis à la CANA.");
    }

    return;
  }

  throw ApiError.forbidden("Votre rôle ne permet pas de consulter ce dossier.");
};

// Résout les noms d'affichage du responsable/coordonnateur CANA
// (toujours des comptes `User`) sans changer la forme des champs
// eux-mêmes, nécessaires ailleurs pour les comparaisons de
// permission. L'agent SOA, lui, porte déjà son nom en dur (voir
// authorSchema côté modèle) : rien à résoudre pour `soa.agent`.
const attachDisplayNames = async (plain) => {
  const ids = [plain.cana?.responsable, plain.cana?.coordinateurBergeries]
    .filter(Boolean)
    .map(String);

  if (plain.soa?.agent) plain.soa.agentName = plain.soa.agent.name;

  if (ids.length === 0) return plain;

  const users = await User.find({ _id: { $in: ids } }).select("name").lean();
  const nameById = new Map(users.map((item) => [String(item._id), item.name]));

  if (plain.cana?.responsable) {
    plain.cana.responsableName = nameById.get(String(plain.cana.responsable));
  }
  if (plain.cana?.coordinateurBergeries) {
    plain.cana.coordinateurBergeriesName = nameById.get(
      String(plain.cana.coordinateurBergeries)
    );
  }

  return plain;
};

export const getById = async (id, actor) => {
  const newSoul = await withConfidentialSelect(NewSoul.findById(id), actor);

  if (!newSoul) throw ApiError.notFound("Dossier introuvable.");

  assertCanView(newSoul, actor);

  return attachDisplayNames(stripConfidentialFields(newSoul, actor));
};

export const list = async (actor, { status, search } = {}) => {
  const filter = {};

  if (isAdminUser(actor)) {
    // Aucun filtre : voit tout.
  } else if (isSoaCapable(actor)) {
    filter["createdBy.kind"] = actor.kind;
    filter["createdBy.id"] = actor.id;
  } else if (isCanaSideUser(actor)) {
    filter.status = { $nin: SOA_EDITABLE_STATUSES };
  } else {
    throw ApiError.forbidden("Votre rôle ne permet pas de consulter ces dossiers.");
  }

  if (status && NEW_SOUL_STATUSES.includes(status)) {
    filter.status = status;
  }

  if (search) {
    const regex = new RegExp(search.trim(), "i");

    filter.$or = [
      { caseNumber: regex },
      { "soa.firstName": regex },
      { "soa.lastName": regex },
      { "soa.phone": regex },
    ];
  }

  const items = await NewSoul.find(filter).sort({ createdAt: -1 }).lean();

  return items.map((item) => stripConfidentialFields(item, actor)).map((item) => {
    if (item.soa?.agent) item.soa.agentName = item.soa.agent.name;

    return item;
  });
};

export const updateSoa = async (id, patch, actor) => {
  const newSoul = await NewSoul.findById(id);

  if (!newSoul) throw ApiError.notFound("Dossier introuvable.");

  if (!isAdminUser(actor)) {
    if (!isSoaCapable(actor)) {
      throw ApiError.forbidden("Votre rôle ne permet pas de modifier ce dossier.");
    }

    if (!ownsRecord(newSoul, actor)) {
      throw ApiError.forbidden("Vous ne pouvez modifier que vos propres dossiers.");
    }
  }

  if (!SOA_EDITABLE_STATUSES.includes(newSoul.status)) {
    throw ApiError.forbidden(
      "Ce dossier a déjà été transmis à la CANA : la partie SOA n'est plus modifiable."
    );
  }

  for (const [key, value] of Object.entries(patch)) {
    if (SOA_SYSTEM_FIELDS.has(key)) continue;

    newSoul.soa[key] = value;
  }

  await newSoul.save();

  return attachDisplayNames(stripConfidentialFields(newSoul, actor));
};

export const transmit = async (id, actor) => {
  const newSoul = await NewSoul.findById(id);

  if (!newSoul) throw ApiError.notFound("Dossier introuvable.");

  if (!isAdminUser(actor) && !isSoaCapable(actor)) {
    throw ApiError.forbidden("Votre rôle ne permet pas de transmettre ce dossier.");
  }

  if (!isAdminUser(actor) && !ownsRecord(newSoul, actor)) {
    throw ApiError.forbidden("Vous ne pouvez transmettre que vos propres dossiers.");
  }

  if (!SOA_EDITABLE_STATUSES.includes(newSoul.status)) {
    throw ApiError.conflict("Ce dossier a déjà été transmis.");
  }

  if (!newSoul.soa.firstName || !newSoul.soa.lastName || !newSoul.soa.phone) {
    throw ApiError.unprocessable(
      "Nom, prénom et téléphone sont indispensables avant transmission."
    );
  }

  const now = new Date();

  newSoul.soa.lockedAt = now;
  newSoul.soa.transmittedAt = now;
  newSoul.soa.transmittedBy = actor.name;

  applyStatus(newSoul, "attente_cana", actor);

  await newSoul.save();

  return attachDisplayNames(stripConfidentialFields(newSoul, actor));
};

// Premier appel de la CANA sur un dossier transmis : préremplit
// responsable + date de réception plutôt que de les faire ressaisir.
export const acknowledge = async (id, actor) => {
  if (!isCanaSideUser(actor) || (actor.kind === "user" && actor.role === "pasteur")) {
    throw ApiError.forbidden("Votre rôle ne permet pas d'accuser réception d'un dossier.");
  }

  const newSoul = await NewSoul.findById(id);

  if (!newSoul) throw ApiError.notFound("Dossier introuvable.");

  if (SOA_EDITABLE_STATUSES.includes(newSoul.status)) {
    throw ApiError.conflict("Ce dossier n'a pas encore été transmis par le SOA.");
  }

  if (!newSoul.cana.acknowledgedAt) {
    newSoul.cana.acknowledgedAt = new Date();
    newSoul.cana.acknowledgedBy = actor.id;
    newSoul.cana.receivedAt = newSoul.cana.receivedAt ?? new Date();
    newSoul.cana.responsable = newSoul.cana.responsable ?? actor.id;

    await newSoul.save();
  }

  return attachDisplayNames(stripConfidentialFields(newSoul, actor));
};

export const updateCana = async (id, patch, actor) => {
  if (!isCanaSideUser(actor)) {
    throw ApiError.forbidden("Votre rôle ne permet pas de modifier ce dossier.");
  }

  const newSoul = await withConfidentialSelect(NewSoul.findById(id), actor);

  if (!newSoul) throw ApiError.notFound("Dossier introuvable.");

  if (SOA_EDITABLE_STATUSES.includes(newSoul.status)) {
    throw ApiError.conflict("Ce dossier n'a pas encore été transmis par le SOA.");
  }

  if (actor.role === "pasteur") {
    throw ApiError.forbidden("Le rôle pasteur est en lecture seule sur ce module.");
  }

  const isCoordinateur = actor.role === "coordinateur_bergeries";

  for (const [key, value] of Object.entries(patch)) {
    if (CANA_SYSTEM_FIELDS.has(key)) continue;

    if (isCoordinateur && !COORDINATEUR_WRITABLE_FIELDS.has(key)) {
      throw ApiError.forbidden(
        `Votre rôle ne permet pas de modifier le champ "${key}".`
      );
    }

    newSoul.cana[key] = value;
  }

  await newSoul.save();

  return attachDisplayNames(stripConfidentialFields(newSoul, actor));
};

export const updateStatus = async (id, status, actor, note) => {
  if (!isCanaSideUser(actor) || actor.role === "pasteur") {
    throw ApiError.forbidden("Votre rôle ne permet pas de changer le statut de ce dossier.");
  }

  if (!NEW_SOUL_STATUSES.includes(status) || SOA_EDITABLE_STATUSES.includes(status)) {
    throw ApiError.badRequest("Statut invalide.");
  }

  const newSoul = await NewSoul.findById(id);

  if (!newSoul) throw ApiError.notFound("Dossier introuvable.");

  if (SOA_EDITABLE_STATUSES.includes(newSoul.status)) {
    throw ApiError.conflict("Ce dossier n'a pas encore été transmis par le SOA.");
  }

  applyStatus(newSoul, status, actor, note);

  await newSoul.save();

  return attachDisplayNames(stripConfidentialFields(newSoul, actor));
};

// Valeurs compatibles uniquement : le formulaire CANA (fiche papier)
// et le modèle `Member` n'ont pas exactement le même vocabulaire pour
// la situation matrimoniale — mieux vaut laisser le champ vide sur le
// nouveau membre qu'échouer la création ou deviner une correspondance
// approximative (ex. "séparé(e)" n'a pas d'équivalent chez `Member`).
const MARITAL_STATUS_TO_MEMBER = {
  celibataire: "celibataire",
  marie: "marie",
  veuf: "veuf",
};

const buildMemberPayload = async (newSoul) => {
  const { soa, cana } = newSoul;

  if (!cana.flock) {
    throw ApiError.unprocessable(
      "Aucune bergerie n'a été retenue pour ce dossier (§Q) : impossible de créer le membre."
    );
  }

  const flock = await Flock.findById(cana.flock).lean();

  if (!flock) {
    throw ApiError.unprocessable("La bergerie retenue pour ce dossier est introuvable.");
  }

  const { registrationNumber } = await nextRegistrationNumber({
    church: flock.church,
    flockCode: flock.code,
    year: new Date().getFullYear(),
  });

  const waterBaptismYear = Number.parseInt(soa.waterBaptismYear, 10);

  return {
    firstName: soa.firstName,
    lastName: soa.lastName,
    phone: soa.phone,
    whatsapp: soa.whatsapp,
    area: soa.area,
    gender: soa.gender,
    church: flock.church,
    flock: flock._id,
    registrationNumber,
    dateOfBirth: cana.dateOfBirth,
    maritalStatus: MARITAL_STATUS_TO_MEMBER[cana.maritalStatus],
    profession: cana.profession,
    previousChurch: cana.previousChurch,
    baptism: {
      water: soa.waterBaptism === "oui",
      waterYear: Number.isInteger(waterBaptismYear) ? waterBaptismYear : undefined,
    },
  };
};

export const close = async (id, actor) => {
  if (!isCanaSideUser(actor) || actor.role === "pasteur" || actor.role === "coordinateur_bergeries") {
    throw ApiError.forbidden("Votre rôle ne permet pas de clôturer ce dossier.");
  }

  const newSoul = await NewSoul.findById(id);

  if (!newSoul) throw ApiError.notFound("Dossier introuvable.");

  if (newSoul.status === "cloture") {
    throw ApiError.conflict("Ce dossier est déjà clôturé.");
  }

  if (SOA_EDITABLE_STATUSES.includes(newSoul.status)) {
    throw ApiError.conflict("Ce dossier n'a pas encore été transmis par le SOA.");
  }

  const memberPayload = await buildMemberPayload(newSoul);
  const member = await Member.create(memberPayload);

  const now = new Date();

  newSoul.createdMemberId = member._id;
  newSoul.cana.closedAt = now;
  newSoul.cana.closedByResponsable = actor.id;
  newSoul.cana.closedByCoordinateur = newSoul.cana.coordinateurBergeries;

  applyStatus(newSoul, "cloture", actor);

  await newSoul.save();

  return attachDisplayNames(stripConfidentialFields(newSoul, actor));
};
