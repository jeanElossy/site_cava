import MonitorSubstitution from "../models/MonitorSubstitution.js";
import MonitorAssignment from "../models/MonitorAssignment.js";
import ChildSession from "../models/ChildSession.js";
import SundaySchoolClass from "../models/SundaySchoolClass.js";
import Member from "../models/Member.js";
import { ApiError } from "../utils/ApiError.js";
import {
  isSubstitutionActiveAt,
  substitutionBounds,
  substitutionsOverlap,
} from "../utils/substitutionWindow.js";

// Remplacements temporaires d'un moniteur par un autre.

// État AFFICHÉ d'un remplacement — « à venir », « actif », « terminé ».
//
// Calculé, jamais stocké : le modèle ne connaît que `valide` et
// `annule` (voir MonitorSubstitution.js). Les onglets de l'écran
// d'administration s'appuient sur cette fonction, pas sur un champ.
export const substitutionState = (substitution, at = new Date()) => {
  if (substitution.status === "annule") return "annule";

  if (isSubstitutionActiveAt(substitution, at)) return "actif";

  const { to } = substitutionBounds(substitution);

  if (to && new Date(to) < at) return "termine";

  return "a_venir";
};

const serialize = (substitution, at = new Date()) => {
  const { from, to } = substitutionBounds(substitution);

  return {
    ...substitution,
    id: String(substitution._id),
    state: substitutionState(substitution, at),
    from,
    to,
  };
};

// Jours couverts, déduits des séances retenues.
//
// DÉNORMALISATION ASSUMÉE : sans elle, chaque contrôle d'accès devrait
// charger les séances — or ce contrôle a lieu à chaque requête d'un
// moniteur. Recalculée à chaque écriture, jamais saisie.
const resolveSessionDates = async (sessionIds) => {
  if (!sessionIds?.length) return { sessions: [], sessionDates: [] };

  const sessions = await ChildSession.find({ _id: { $in: sessionIds } })
    .select("_id date class")
    .lean();

  if (sessions.length !== sessionIds.length) {
    throw ApiError.unprocessable("Une des séances sélectionnées est introuvable.", {
      sessions: "Vérifiez les séances choisies.",
    });
  }

  return {
    sessions: sessions.map((session) => session._id),
    sessionDates: sessions.map((session) => session.date),
  };
};

// Refuse un remplacement qui en recouvre un autre, déjà valide, pour
// le même moniteur ET la même classe.
//
// Deux classes différentes le même jour restent AUTORISÉES : un
// moniteur peut enchaîner deux salles, et l'interdire bloquerait un
// cas réel au nom d'une cohérence théorique.
//
// Cette règle ne peut pas être un index : MongoDB ne sait pas indexer
// un intervalle. Elle est donc nécessairement applicative — et c'est
// la raison pour laquelle elle vit ici, avant toute écriture, plutôt
// que dispersée dans les routes.
const assertNoConflict = async (candidate, { excludeId } = {}) => {
  const filter = {
    monitor: candidate.monitor,
    class: candidate.class,
    status: "valide",
  };

  if (excludeId) filter._id = { $ne: excludeId };

  const existing = await MonitorSubstitution.find(filter).lean();

  const clash = existing.find((other) => substitutionsOverlap(candidate, other));

  if (clash) {
    const { from, to } = substitutionBounds(clash);

    throw ApiError.conflict(
      "Ce moniteur remplace déjà sur cette classe pendant cette période" +
        (from ? ` (du ${from.toISOString().slice(0, 10)} au ${to.toISOString().slice(0, 10)})` : "") +
        "."
    );
  }
};

export const list = async ({ church, classId, monitorId, state } = {}) => {
  const filter = {};

  if (church) filter.church = church;
  if (classId) filter.class = classId;
  if (monitorId) filter.monitor = monitorId;

  const substitutions = await MonitorSubstitution.find(filter)
    .populate("monitor", "firstName lastName registrationNumber photo")
    .populate("replacedMonitor", "firstName lastName registrationNumber photo")
    .populate("class", "name icon room church")
    .sort({ createdAt: -1 })
    .lean();

  const at = new Date();
  const items = substitutions.map((substitution) => serialize(substitution, at));

  // Le filtre par état s'applique APRÈS calcul : « actif » n'existe
  // pas en base, il se déduit de la date du jour.
  return state ? items.filter((item) => item.state === state) : items;
};

export const create = async (payload, user) => {
  const {
    monitorId,
    replacedMonitorId,
    classId,
    mode,
    startDate,
    endDate,
    sessionIds,
    reason,
  } = payload ?? {};

  const [monitor, target] = await Promise.all([
    Member.findById(monitorId).lean(),
    SundaySchoolClass.findById(classId).lean(),
  ]);

  if (!monitor) {
    throw ApiError.unprocessable("Moniteur remplaçant introuvable.", {
      monitorId: "Choisissez un membre enregistré.",
    });
  }

  if (!target || target.status === "archived") {
    throw ApiError.unprocessable("Classe introuvable ou archivée.", {
      classId: "Choisissez une classe active.",
    });
  }

  // Le remplaçant doit lui-même être moniteur en exercice. Sans cette
  // règle, un remplacement suffirait à donner accès aux enfants à
  // n'importe quel membre — en contournant entièrement l'écran
  // d'affectation et ses contrôles.
  const assignment = await MonitorAssignment.findOne({
    member: monitorId,
    status: "active",
  }).lean();

  if (!assignment) {
    throw ApiError.unprocessable(
      "Ce membre n'est pas moniteur en exercice : attribuez-lui d'abord la fonction.",
      { monitorId: "Fonction de moniteur requise." }
    );
  }

  const { sessions, sessionDates } =
    mode === "period" ? { sessions: [], sessionDates: [] } : await resolveSessionDates(sessionIds);

  const candidate = {
    monitor: monitorId,
    replacedMonitor: replacedMonitorId || undefined,
    class: target._id,
    church: target.church,
    mode,
    startDate: mode === "period" ? startDate : undefined,
    endDate: mode === "period" ? endDate : undefined,
    sessions,
    sessionDates,
    reason,
    status: "valide",
    createdBy: user?.id,
  };

  await assertNoConflict(candidate);

  const document = await MonitorSubstitution.create(candidate);

  return serialize(document.toObject());
};

export const update = async (id, payload) => {
  const substitution = await MonitorSubstitution.findById(id);

  if (!substitution) throw ApiError.notFound("Remplacement introuvable.");

  if (substitution.status === "annule") {
    throw ApiError.badRequest(
      "Ce remplacement est annulé : créez-en un nouveau plutôt que de le modifier."
    );
  }

  const { mode, startDate, endDate, sessionIds, reason, replacedMonitorId } =
    payload ?? {};

  if (mode !== undefined) substitution.mode = mode;
  if (reason !== undefined) substitution.reason = reason;
  if (replacedMonitorId !== undefined) {
    substitution.replacedMonitor = replacedMonitorId || undefined;
  }

  if (substitution.mode === "period") {
    if (startDate !== undefined) substitution.startDate = startDate;
    if (endDate !== undefined) substitution.endDate = endDate;

    substitution.sessions = [];
    substitution.sessionDates = [];
  } else if (sessionIds !== undefined) {
    const { sessions, sessionDates } = await resolveSessionDates(sessionIds);

    substitution.sessions = sessions;
    substitution.sessionDates = sessionDates;
    substitution.startDate = undefined;
    substitution.endDate = undefined;
  }

  await assertNoConflict(substitution.toObject(), { excludeId: substitution._id });

  await substitution.save();

  return serialize(substitution.toObject());
};

// ANNULATION, jamais suppression.
//
// Supprimer effacerait la trace d'un accès qui a réellement existé —
// or des présences enregistrées y font référence (voir
// ChildAttendance.substitution), et l'audit doit pouvoir répondre des
// mois plus tard à « au titre de quoi cette personne était-elle dans
// cette salle ». Une annulation ferme l'accès sans effacer l'histoire.
export const cancel = async (id, { reason } = {}) => {
  const substitution = await MonitorSubstitution.findById(id);

  if (!substitution) throw ApiError.notFound("Remplacement introuvable.");

  substitution.status = "annule";
  substitution.cancelledAt = new Date();

  if (reason) substitution.cancelReason = reason;

  await substitution.save();

  return serialize(substitution.toObject());
};

// Remplacements d'un moniteur, pour son propre espace.
export const listForMonitor = async (memberId) => {
  const substitutions = await MonitorSubstitution.find({ monitor: memberId })
    .populate("class", "name icon room")
    .populate("replacedMonitor", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();

  const at = new Date();

  return substitutions.map((substitution) => serialize(substitution, at));
};
