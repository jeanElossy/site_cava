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
import * as pushService from "./push.service.js";

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
// Deux origines possibles, avec des périmètres différents :
//
//   - un agent de badgeage des présences (`kind: "member"`) démarre un
//     dossier à l'accueil, sur SA session de scan — il ne voit que les
//     dossiers qu'il a lui-même créés pendant cette session, jamais
//     ceux d'un autre agent de présence.
//   - un compte admin `role: "soa"` (`kind: "user"`) est un membre de
//     l'équipe SOA qui se connecte ensuite pour reprendre CE dossier
//     et "commencer le suivi" (voir VisitorsPanel → porte d'entrée
//     vers /admin/connexion) : il voit TOUS les dossiers pas encore
//     transmis, comme une file partagée — pas seulement ceux qu'il a
//     personnellement créés, à l'image de la CANA qui partage déjà les
//     dossiers transmis entre ses membres.
//
// `isSoaCapable` reste le test "a le droit de toucher au côté SOA" au
// sens large ; `isPresenceAgent`/`isSoaUser` distinguent ensuite quelle
// règle de VISIBILITÉ s'applique à chacun.
const isAdminUser = (actor) => actor.kind === "user" && actor.role === "admin";
const isPresenceAgent = (actor) => actor.kind === "member";
const isSoaUser = (actor) => actor.kind === "user" && actor.role === "soa";
const isSoaCapable = (actor) => isPresenceAgent(actor) || isSoaUser(actor);
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

const dossierDisplayName = (newSoul) =>
  `${newSoul.soa?.firstName ?? ""} ${newSoul.soa?.lastName ?? ""}`.trim() || newSoul.caseNumber;

// Volontairement non attendues (pas de `await`) aux deux points
// d'appel ci-dessous : une notification push ne doit jamais retarder
// la réponse HTTP de l'action métier, et push.service.js garantit de
// son côté ne jamais lever — voir la règle en tête de ce fichier.
const notifyNewDossier = (newSoul) => {
  pushService.sendToRoles(["soa"], {
    title: "Nouveau dossier SOA à traiter",
    body: dossierDisplayName(newSoul),
    url: `/admin/nouvelles-ames/${newSoul._id}`,
  });
};

const notifyTransmission = (newSoul) => {
  pushService.sendToRoles(["cana", "coordinateur_bergeries"], {
    title: "Dossier transmis à la CANA",
    body: dossierDisplayName(newSoul),
    url: `/admin/nouvelles-ames/${newSoul._id}`,
  });
};

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

  // Seul le cas qui compte pour l'équipe SOA : un agent de présence
  // vient de démarrer un dossier à l'accueil, que personne n'a encore
  // en charge (voir VisitorsPanel → porte d'entrée vers la connexion
  // admin). Un compte SOA/admin qui crée directement son propre
  // dossier n'a pas besoin de se notifier lui-même.
  if (isPresenceAgent(actor)) notifyNewDossier(newSoul);

  return attachDisplayNames(stripConfidentialFields(newSoul, actor));
};

const assertCanView = (newSoul, actor) => {
  if (isAdminUser(actor)) return;

  if (isSoaUser(actor)) {
    if (!SOA_EDITABLE_STATUSES.includes(newSoul.status)) {
      throw ApiError.forbidden("Ce dossier a déjà été transmis à la CANA.");
    }

    return;
  }

  if (isPresenceAgent(actor)) {
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

// Filtre de visibilité partagé entre `list` et `getStats` : une seule
// définition de "qui voit quoi" pour ce module, plutôt qu'une copie
// par endpoint qui finit par diverger.
const buildVisibilityFilter = (actor) => {
  if (isAdminUser(actor)) return {};

  if (isSoaUser(actor)) {
    return { status: { $in: SOA_EDITABLE_STATUSES } };
  }

  if (isPresenceAgent(actor)) {
    return { "createdBy.kind": actor.kind, "createdBy.id": actor.id };
  }

  if (isCanaSideUser(actor)) {
    return { status: { $nin: SOA_EDITABLE_STATUSES } };
  }

  throw ApiError.forbidden("Votre rôle ne permet pas de consulter ces dossiers.");
};

export const list = async (actor, { status, search, archived } = {}) => {
  const filter = buildVisibilityFilter(actor);

  // Par défaut, jamais les dossiers archivés (mis en pause) : ils ne
  // doivent pas encombrer la file de travail active. `archived=true`
  // bascule sur la vue dédiée où l'agent va les reprendre.
  filter.archivedAt =
    archived === true || archived === "true" ? { $exists: true } : { $exists: false };

  if (status && NEW_SOUL_STATUSES.includes(status)) {
    // Un statut explicite ne doit jamais ÉLARGIR la visibilité : sans
    // ce garde-fou, `filter.status = status` écrasait purement et
    // simplement le `$nin`/`$in` posé ci-dessus, laissant par exemple
    // la CANA voir un dossier "nouveau" (pas encore transmis) ou un
    // agent SOA voir un dossier déjà transmis, en passant juste ce
    // statut en paramètre.
    // `isCanaSideUser` inclut "admin" (voir CANA_SIDE_ROLES) : sans ce
    // `!isAdminUser`, un compte admin se voyait refuser les statuts
    // côté SOA alors que `buildVisibilityFilter` lui laisse déjà voir
    // absolument tous les dossiers sans restriction.
    if (!isAdminUser(actor) && isCanaSideUser(actor) && SOA_EDITABLE_STATUSES.includes(status)) {
      throw ApiError.forbidden(
        "Ce statut concerne des dossiers non encore transmis à la CANA."
      );
    }

    if (isSoaUser(actor) && !SOA_EDITABLE_STATUSES.includes(status)) {
      throw ApiError.forbidden(
        "Ce statut concerne des dossiers déjà transmis à la CANA."
      );
    }

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

// Fenêtre de rappel pour les suivis mensuels CANA (§O) : les 14
// prochains jours — assez large pour anticiper une prise de
// rendez-vous, assez courte pour ne pas noyer le tableau de bord de
// suivis encore lointains.
const UPCOMING_FOLLOW_UP_WINDOW_DAYS = 14;

// Chiffres clés du tableau de bord "Nouvelles âmes", dans le même
// périmètre de visibilité que `list` (voir `buildVisibilityFilter`) :
// un agent SOA n'y voit que ses propres dossiers, la CANA que les
// dossiers déjà transmis.
export const getStats = async (actor) => {
  const filter = buildVisibilityFilter(actor);

  // Un dossier archivé (mis en pause) ne doit pas peser sur les
  // compteurs "à traiter" du tableau de bord/badge — voir `list` pour
  // le même principe côté liste.
  filter.archivedAt = { $exists: false };

  const items = await NewSoul.find(filter)
    .select(
      "caseNumber status soa.firstName soa.lastName cana.monthlyFollowUps cana.closedAt cana.acknowledgedAt"
    )
    .lean();

  const byStatus = Object.fromEntries(NEW_SOUL_STATUSES.map((status) => [status, 0]));
  const soaEditableSet = new Set(SOA_EDITABLE_STATUSES);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const followUpDeadline = new Date(now.getTime() + UPCOMING_FOLLOW_UP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let soaPending = 0;
  let canaActive = 0;
  let closedThisMonth = 0;
  // Dossiers transmis que la CANA n'a pas encore ouverts une seule
  // fois (voir `acknowledge` : premier appel, jamais ressaisi). Sert
  // de repère "à traiter" pour le badge du menu, distinct de
  // `canaActive` qui compte tout l'accompagnement en cours.
  let awaitingAcknowledgement = 0;
  const upcomingFollowUps = [];

  for (const item of items) {
    if (byStatus[item.status] !== undefined) byStatus[item.status] += 1;

    if (soaEditableSet.has(item.status)) {
      soaPending += 1;
    } else if (item.status !== "cloture") {
      canaActive += 1;

      if (!item.cana?.acknowledgedAt) awaitingAcknowledgement += 1;
    }

    if (item.status === "cloture" && item.cana?.closedAt >= startOfMonth) {
      closedThisMonth += 1;
    }

    for (const followUp of item.cana?.monthlyFollowUps ?? []) {
      if (followUp.reviewDate && followUp.reviewDate >= now && followUp.reviewDate <= followUpDeadline) {
        upcomingFollowUps.push({
          newSoulId: item._id,
          caseNumber: item.caseNumber,
          name: `${item.soa?.firstName ?? ""} ${item.soa?.lastName ?? ""}`.trim(),
          period: followUp.period,
          reviewDate: followUp.reviewDate,
        });
      }
    }
  }

  upcomingFollowUps.sort((a, b) => a.reviewDate - b.reviewDate);

  return {
    total: items.length,
    byStatus,
    soaPending,
    canaActive,
    closedThisMonth,
    awaitingAcknowledgement,
    upcomingFollowUps: upcomingFollowUps.slice(0, 5),
  };
};

// Fenêtre du RAPPEL POUSSÉ (push) — bien plus courte que les 14 jours
// affichés dans le badge/tableau de bord (`getStats`, ci-dessus) : un
// rappel poussé n'a de sens que tout près de l'échéance, pas deux
// semaines à l'avance. `graceStart` (24h dans le passé) rattrape un
// suivi dont la date est passée depuis la veille, au cas où le
// balayage précédent aurait manqué de justesse la fenêtre.
const FOLLOW_UP_REMINDER_LEAD_DAYS = 2;

// Balayage quotidien (voir jobs/followUpReminders.js) : pousse un
// rappel une seule fois par suivi mensuel (marqué via
// `reminderSentAt`), à la CANA et au coordonnateur des bergeries — pas
// à un acteur précis, contrairement au reste de ce fichier, puisque
// c'est un job d'arrière-plan, pas une action d'un utilisateur.
export const sendUpcomingFollowUpReminders = async () => {
  const now = new Date();
  const deadline = new Date(now.getTime() + FOLLOW_UP_REMINDER_LEAD_DAYS * 24 * 60 * 60 * 1000);
  const graceStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const candidates = await NewSoul.find({
    status: { $nin: SOA_EDITABLE_STATUSES },
    "cana.monthlyFollowUps": {
      $elemMatch: {
        reviewDate: { $gte: graceStart, $lte: deadline },
        reminderSentAt: { $exists: false },
      },
    },
  }).select("caseNumber soa.firstName soa.lastName cana.monthlyFollowUps");

  let sent = 0;

  for (const newSoul of candidates) {
    let changed = false;

    for (const followUp of newSoul.cana.monthlyFollowUps) {
      if (followUp.reminderSentAt) continue;
      if (!followUp.reviewDate) continue;
      if (followUp.reviewDate < graceStart || followUp.reviewDate > deadline) continue;

      // Attendu (pas de fire-and-forget) : ceci est un job
      // d'arrière-plan, pas une requête HTTP à faire répondre vite —
      // autant s'assurer que l'envoi a été tenté avant de marquer
      // `reminderSentAt`, plutôt que de risquer un rappel jamais parti
      // mais jamais reproposé non plus.
      await pushService.sendToRoles(["cana", "coordinateur_bergeries"], {
        title: "Suivi mensuel à venir",
        body: `${dossierDisplayName(newSoul)} — ${followUp.period}`,
        url: `/admin/nouvelles-ames/${newSoul._id}`,
      });

      followUp.reminderSentAt = now;
      changed = true;
      sent += 1;
    }

    if (changed) await newSoul.save();
  }

  return sent;
};

export const updateSoa = async (id, patch, actor) => {
  const newSoul = await NewSoul.findById(id);

  if (!newSoul) throw ApiError.notFound("Dossier introuvable.");

  if (!isAdminUser(actor)) {
    if (!isSoaCapable(actor)) {
      throw ApiError.forbidden("Votre rôle ne permet pas de modifier ce dossier.");
    }

    // Un agent de présence ne complète que SES dossiers ; un compte
    // SOA reprend n'importe quel dossier de la file partagée (voir
    // `isSoaUser` plus haut).
    if (isPresenceAgent(actor) && !ownsRecord(newSoul, actor)) {
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

  if (isPresenceAgent(actor) && !ownsRecord(newSoul, actor)) {
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

  notifyTransmission(newSoul);

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

  // Le millésime du matricule doit correspondre à l'arrivée réelle de
  // la personne à l'église, pas à la date de clôture administrative du
  // dossier (un dossier peut être clôturé des mois après le premier
  // contact) — même principe que pour les inscriptions publiques, voir
  // `submission.service.js`. `firstVisitAt` (première visite, §A) est
  // la donnée la plus fiable ; à défaut on retombe sur `openedAt`
  // (ouverture du dossier par le SOA), toujours renseignée.
  const arrivalDate = soa.firstVisitAt ?? soa.openedAt ?? new Date();

  const { registrationNumber } = await nextRegistrationNumber({
    church: flock.church,
    flockCode: flock.code,
    year: arrivalDate.getFullYear(),
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
    joinedAt: arrivalDate,
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

// Même règle "qui a le droit d'écrire sur ce dossier en ce moment" que
// `updateSoa`/`updateCana` — l'archivage n'est jamais qu'une mise en
// pause, pas une action distincte avec ses propres permissions : celui
// qui peut modifier le dossier peut aussi le mettre de côté puis le
// reprendre.
const assertCanArchive = (newSoul, actor) => {
  if (isAdminUser(actor)) return;

  if (SOA_EDITABLE_STATUSES.includes(newSoul.status)) {
    if (!isSoaCapable(actor)) {
      throw ApiError.forbidden("Votre rôle ne permet pas d'archiver ce dossier.");
    }

    if (isPresenceAgent(actor) && !ownsRecord(newSoul, actor)) {
      throw ApiError.forbidden("Vous ne pouvez archiver que vos propres dossiers.");
    }

    return;
  }

  if (!isCanaSideUser(actor) || actor.role === "pasteur") {
    throw ApiError.forbidden("Votre rôle ne permet pas d'archiver ce dossier.");
  }
};

export const archive = async (id, actor, reason) => {
  const newSoul = await NewSoul.findById(id);

  if (!newSoul) throw ApiError.notFound("Dossier introuvable.");

  assertCanArchive(newSoul, actor);

  if (newSoul.status === "cloture") {
    throw ApiError.conflict("Ce dossier est déjà clôturé, inutile de l'archiver.");
  }

  if (newSoul.archivedAt) {
    throw ApiError.conflict("Ce dossier est déjà archivé.");
  }

  newSoul.archivedAt = new Date();
  newSoul.archivedBy = toAuthor(actor);
  newSoul.archiveReason = reason ? String(reason).trim().slice(0, 300) : undefined;

  await newSoul.save();

  return attachDisplayNames(stripConfidentialFields(newSoul, actor));
};

export const unarchive = async (id, actor) => {
  const newSoul = await NewSoul.findById(id);

  if (!newSoul) throw ApiError.notFound("Dossier introuvable.");

  assertCanArchive(newSoul, actor);

  if (!newSoul.archivedAt) {
    throw ApiError.conflict("Ce dossier n'est pas archivé.");
  }

  newSoul.archivedAt = undefined;
  newSoul.archivedBy = undefined;
  newSoul.archiveReason = undefined;

  await newSoul.save();

  return attachDisplayNames(stripConfidentialFields(newSoul, actor));
};
