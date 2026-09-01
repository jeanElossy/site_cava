import ChildSession from "../models/ChildSession.js";
import ChildAttendance, {
  CHILD_ATTENDANCE_STATUSES,
} from "../models/ChildAttendance.js";
import Child from "../models/Child.js";
import SundaySchoolClass from "../models/SundaySchoolClass.js";
import { ApiError } from "../utils/ApiError.js";
import { resolveClassAccess } from "./monitor.service.js";

// Appel des présences.

// Ouvre (ou retrouve) la séance du jour pour une classe.
//
// IDEMPOTENT par construction : l'index unique `{class, date}` fait
// que deux moniteurs qui ouvrent l'appel à dix minutes d'intervalle
// tombent sur LA MÊME séance. On s'appuie sur l'erreur de doublon
// plutôt que sur une lecture préalable — une lecture laisserait une
// fenêtre entre le « ça n'existe pas » et l'écriture.
export const openSession = async (
  { classId, date, type, title, theme, startTime, endTime, room, eventId },
  { monitorId, user } = {}
) => {
  const target = new Date(date ?? Date.now());

  if (Number.isNaN(target.getTime())) {
    throw ApiError.badRequest("Date de séance invalide.");
  }

  const classDoc = await SundaySchoolClass.findById(classId).lean();

  if (!classDoc || classDoc.status === "archived") {
    throw ApiError.unprocessable("Classe introuvable ou archivée.", {
      classId: "Choisissez une classe active.",
    });
  }

  try {
    const session = await ChildSession.create({
      class: classId,
      church: classDoc.church,
      date: target,
      type: type ?? "ecole_du_dimanche",
      title: title ?? classDoc.name,
      theme,
      // Horaires de la classe recopiés à la création, pas lus à
      // l'affichage : une classe qui change d'horaire ne doit pas
      // réécrire l'histoire de ses séances passées.
      startTime: startTime ?? classDoc.usualStartTime,
      endTime: endTime ?? classDoc.usualEndTime,
      room: room ?? classDoc.room,
      event: eventId,
      responsibleMonitor: monitorId,
      createdBy: user?.id,
    });

    return { session: session.toJSON(), created: true };
  } catch (error) {
    if (error.code === 11000) {
      const existing = await ChildSession.findOne({
        class: classId,
        date: new Date(
          Date.UTC(
            target.getUTCFullYear(),
            target.getUTCMonth(),
            target.getUTCDate()
          )
        ),
      });

      return { session: existing.toJSON(), created: false };
    }

    throw error;
  }
};

// Feuille d'appel : les enfants ACTIFS de la classe, avec leur statut
// déjà saisi s'il y en a un.
export const rollCall = async (sessionId) => {
  const session = await ChildSession.findById(sessionId)
    .populate("class", "name icon room church")
    .lean();

  if (!session) throw ApiError.notFound("Séance introuvable.");

  const [children, attendances] = await Promise.all([
    Child.find({ currentClass: session.class._id, status: "actif" })
      .select("fileNumber firstName lastName photo dateOfBirth")
      .sort({ firstName: 1, lastName: 1 })
      .lean(),
    ChildAttendance.find({ session: sessionId }).lean(),
  ]);

  const byChild = new Map(
    attendances.map((item) => [String(item.child), item])
  );

  return {
    session,
    children: children.map((item) => {
      const attendance = byChild.get(String(item._id));

      return {
        ...item,
        id: String(item._id),
        status: attendance?.status ?? null,
        note: attendance?.note ?? null,
        recordedAt: attendance?.recordedAt ?? null,
      };
    }),
  };
};

// Enregistre l'appel COMPLET en un seul envoi.
//
// ------------------------------------------------------------------
// UN SEUL ALLER-RETOUR, ET UN SEUL `bulkWrite`
// ------------------------------------------------------------------
// L'alternative — une requête par enfant — ferait vingt-quatre
// allers-retours depuis un téléphone, dans une salle de classe, un
// dimanche matin. Le premier réseau instable laisserait l'appel à
// moitié enregistré, sans que le moniteur sache lesquels sont passés.
//
// `upsert` sur l'index unique `{child, session}` : rejouer exactement
// le même envoi ne crée aucun doublon, ce qui rend le bouton
// « réessayer » sans danger.
export const recordRollCall = async (
  sessionId,
  { entries },
  { monitorId, actorMemberId } = {}
) => {
  const session = await ChildSession.findById(sessionId).lean();

  if (!session) throw ApiError.notFound("Séance introuvable.");

  if (!Array.isArray(entries) || entries.length === 0) {
    throw ApiError.badRequest("Aucune présence à enregistrer.");
  }

  // CONTRÔLE D'ACCÈS AU MOMENT DE L'ÉCRITURE, pas seulement à
  // l'affichage : c'est ici que se joue la règle « après expiration du
  // remplacement, l'accès est refusé ». Un moniteur qui aurait gardé
  // l'écran ouvert la veille ne doit pas pouvoir enregistrer le
  // lendemain.
  const access = await resolveClassAccess(actorMemberId ?? monitorId, session.class);

  if (!access.allowed) {
    throw ApiError.forbidden(
      "Vous n'encadrez pas cette classe aujourd'hui."
    );
  }

  const now = new Date();
  const recordedBy = actorMemberId ?? monitorId;

  // L'accès vient-il d'un remplacement ? Si oui, chaque ligne le
  // retient — c'est ce qui permettra de répondre, des mois plus tard :
  // « enregistré par Sarah, en remplacement de Jean ».
  const substitutionId = access.substitution?._id ?? undefined;

  const operations = [];

  for (const entry of entries) {
    if (!CHILD_ATTENDANCE_STATUSES.includes(entry.status)) {
      throw ApiError.unprocessable(
        `Statut de présence invalide : « ${entry.status} ».`,
        { entries: "Statuts acceptés : present, absent, excuse." }
      );
    }

    operations.push({
      updateOne: {
        filter: { child: entry.childId, session: sessionId },
        update: {
          $set: {
            status: entry.status,
            note: entry.note,
            class: session.class,
            date: session.date,
            recordedBy,
            recordedAt: now,
            substitution: substitutionId,
          },
          // Posé UNIQUEMENT à la création : sur une correction, ce
          // sont `lastModifiedBy`/`lastModifiedAt` qui bougent (voir
          // `correct` plus bas), et écraser la saisie initiale ferait
          // disparaître l'information la plus utile de l'audit.
          $setOnInsert: { child: entry.childId, session: sessionId },
        },
        upsert: true,
      },
    });
  }

  const result = await ChildAttendance.bulkWrite(operations, { ordered: false });

  // La séance passe « terminée » dès qu'un appel y a été enregistré.
  await ChildSession.updateOne(
    { _id: sessionId, status: "planifiee" },
    { status: "terminee" }
  );

  return {
    recorded: operations.length,
    created: result.upsertedCount ?? 0,
    updated: result.modifiedCount ?? 0,
    via: access.via,
    substitution: access.substitution
      ? {
          id: String(access.substitution._id),
          replacedMonitor: access.substitution.replacedMonitor ?? null,
        }
      : null,
  };
};

// « TOUS PRÉSENTS » — construit l'appel complet côté SERVEUR.
//
// Le bouton n'envoie donc pas vingt-quatre lignes depuis le téléphone :
// il envoie une intention. Le moniteur corrige ensuite les quelques
// absents, ce qui est exactement le geste décrit au cahier des charges.
export const markAllPresent = async (sessionId, context) => {
  const { children } = await rollCall(sessionId);

  return recordRollCall(
    sessionId,
    {
      entries: children.map((child) => ({
        childId: child.id,
        status: "present",
      })),
    },
    context
  );
};

// Correction d'une présence après l'appel.
//
// Distincte de l'enregistrement initial : elle met à jour
// `lastModifiedBy`/`lastModifiedAt` sans toucher à `recordedBy`, et
// c'est elle qui déclenche l'entrée d'audit `attendance_update`.
export const correct = async (
  sessionId,
  childId,
  { status, note },
  { actorMemberId } = {}
) => {
  if (!CHILD_ATTENDANCE_STATUSES.includes(status)) {
    throw ApiError.unprocessable("Statut de présence invalide.", {
      status: "Statuts acceptés : present, absent, excuse.",
    });
  }

  const session = await ChildSession.findById(sessionId).lean();

  if (!session) throw ApiError.notFound("Séance introuvable.");

  const access = await resolveClassAccess(actorMemberId, session.class);

  if (!access.allowed) {
    throw ApiError.forbidden("Vous n'encadrez pas cette classe aujourd'hui.");
  }

  const previous = await ChildAttendance.findOne({
    child: childId,
    session: sessionId,
  }).lean();

  const attendance = await ChildAttendance.findOneAndUpdate(
    { child: childId, session: sessionId },
    {
      $set: {
        status,
        note,
        lastModifiedBy: actorMemberId,
        lastModifiedAt: new Date(),
      },
      $setOnInsert: {
        child: childId,
        session: sessionId,
        class: session.class,
        date: session.date,
        recordedBy: actorMemberId,
        recordedAt: new Date(),
      },
    },
    { new: true, upsert: true }
  );

  return {
    attendance: attendance.toJSON(),
    // Renvoyé pour le journal d'audit, qui doit consigner l'ANCIENNE
    // et la NOUVELLE valeur.
    previousStatus: previous?.status ?? null,
  };
};

// Statistiques d'une séance — pour la pastille « 18/24, 92 % ».
export const sessionStats = async (sessionId) => {
  const rows = await ChildAttendance.aggregate([
    { $match: { session: (await ChildSession.findById(sessionId).select("_id").lean())?._id } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const counts = { present: 0, absent: 0, excuse: 0 };

  for (const row of rows) counts[row._id] = row.count;

  const total = counts.present + counts.absent + counts.excuse;

  return {
    ...counts,
    total,
    rate: total > 0 ? Math.round((counts.present / total) * 100) : null,
  };
};

// Liste des séances pour l'ADMINISTRATION.
//
// L'espace moniteur a sa propre liste (monitor.routes.js), bornée aux
// classes qu'il encadre aujourd'hui. Celle-ci ne connaît pas cette
// restriction : elle sert au responsable, qui suit toutes les classes.
//
// Les compteurs de présence sont obtenus par UNE agrégation groupée
// sur l'ensemble des séances renvoyées, pas par une requête par
// séance : le nombre de requêtes ne doit pas croître avec la taille
// de la page.
export const listSessions = async ({
  church,
  classId,
  from,
  to,
  page = 1,
  limit = 30,
} = {}) => {
  const filter = {};

  if (classId) filter.class = classId;

  if (from || to) {
    filter.date = {};

    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  // `church` est denormalise sur la seance elle-meme (ChildSession.js) :
  // le filtre est direct, sans passer par les classes.
  if (church) filter.church = church;

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  const [sessions, total] = await Promise.all([
    ChildSession.find(filter)
      .populate("class", "name icon room church")
      .populate("responsibleMonitor", "firstName lastName")
      .sort({ date: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    ChildSession.countDocuments(filter),
  ]);

  const sessionIds = sessions.map((item) => item._id);

  const [counts, sizes] = await Promise.all([
    ChildAttendance.aggregate([
      { $match: { session: { $in: sessionIds } } },
      { $group: { _id: { session: "$session", status: "$status" }, count: { $sum: 1 } } },
    ]),
    // Effectif actuel de chaque classe concernée : c'est le
    // dénominateur du taux, et il ne se déduit pas des présences —
    // une séance sans aucun appel n'a aucune ligne.
    Child.aggregate([
      {
        $match: {
          currentClass: { $in: sessions.map((item) => item.class?._id).filter(Boolean) },
          status: "actif",
        },
      },
      { $group: { _id: "$currentClass", count: { $sum: 1 } } },
    ]),
  ]);

  const bySession = new Map();

  for (const row of counts) {
    const key = String(row._id.session);
    const current = bySession.get(key) ?? { present: 0, absent: 0, excuse: 0 };

    current[row._id.status] = row.count;
    bySession.set(key, current);
  }

  const byClass = new Map(sizes.map((row) => [String(row._id), row.count]));

  const items = sessions.map((session) => {
    const tally = bySession.get(String(session._id)) ?? {
      present: 0,
      absent: 0,
      excuse: 0,
    };

    const recorded = tally.present + tally.absent + tally.excuse;
    const expected = byClass.get(String(session.class?._id)) ?? 0;

    return {
      ...session,
      id: String(session._id),
      attendance: {
        ...tally,
        recorded,
        expected,
        // `null` et non `0` tant que personne n'a fait l'appel : « 0 % »
        // se lirait comme « personne n'est venu », alors que la séance
        // n'a simplement pas encore été pointée. Même règle que le
        // tableau de bord.
        rate: recorded > 0 ? Math.round((tally.present / recorded) * 100) : null,
        done: recorded > 0,
      },
    };
  });

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
};
