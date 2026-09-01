import ChildSession from "../models/ChildSession.js";
import ChildAttendance from "../models/ChildAttendance.js";
import Child from "../models/Child.js";
import SundaySchoolClass from "../models/SundaySchoolClass.js";
import MonitorAssignment from "../models/MonitorAssignment.js";

// Chiffres du tableau de bord.
//
// TOUT EST AGRÉGÉ DANS MONGO, jamais compté dans le navigateur : les
// listes sont paginées, et compter une page ne donnerait que le total
// de cette page. C'est la même raison qui impose de trier côté serveur
// ailleurs dans le projet.
//
// Le nombre de requêtes ne dépend PAS du nombre de classes : quatre
// agrégations groupées, et non deux requêtes par classe. Invisible sur
// quatre classes, ce N+1 le resterait longtemps — d'où le choix de ne
// pas l'écrire.

// Jour civil courant, borné comme les séances (voir ChildSession.js).
// Abidjan étant à UTC+0, le jour UTC est le jour vécu sur place.
const today = () => {
  const now = new Date();

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
};

export const dashboard = async ({ church } = {}) => {
  const classFilter = { status: "published", ...(church ? { church } : {}) };

  const classes = await SundaySchoolClass.find(classFilter)
    // Ordre par ÂGE : c'est lui qui donne leur couleur aux classes dans
    // les graphiques (rampe du plus jeune au plus âgé), donc il doit
    // être stable d'un appel à l'autre.
    .sort({ ageMin: 1, name: 1 })
    .lean();

  const classIds = classes.map((item) => item._id);

  const day = today();

  const [childRows, monitorRows, sessions] = await Promise.all([
    Child.aggregate([
      { $match: { currentClass: { $in: classIds }, status: "actif" } },
      { $group: { _id: "$currentClass", count: { $sum: 1 } } },
    ]),

    MonitorAssignment.find({
      primaryClass: { $in: classIds },
      status: "active",
    })
      .populate("member", "firstName lastName photo")
      .lean(),

    ChildSession.find({ class: { $in: classIds }, date: day })
      .select("_id class")
      .lean(),
  ]);

  // Présences du jour, par classe et par statut — une seule agrégation
  // pour toutes les classes.
  const attendanceRows = sessions.length
    ? await ChildAttendance.aggregate([
        { $match: { session: { $in: sessions.map((item) => item._id) } } },
        {
          $group: {
            _id: { class: "$class", status: "$status" },
            count: { $sum: 1 },
          },
        },
      ])
    : [];

  const childByClass = new Map(
    childRows.map((row) => [String(row._id), row.count])
  );

  const monitorsByClass = new Map();

  for (const assignment of monitorRows) {
    const key = String(assignment.primaryClass);

    if (!monitorsByClass.has(key)) monitorsByClass.set(key, []);

    monitorsByClass.get(key).push({
      id: String(assignment._id),
      level: assignment.level,
      member: assignment.member,
    });
  }

  const attendanceByClass = new Map();

  for (const row of attendanceRows) {
    const key = String(row._id.class);

    if (!attendanceByClass.has(key)) {
      attendanceByClass.set(key, { present: 0, absent: 0, excuse: 0 });
    }

    attendanceByClass.get(key)[row._id.status] = row.count;
  }

  const sessionByClass = new Map(
    sessions.map((item) => [String(item.class), String(item._id)])
  );

  const items = classes.map((item) => {
    const key = String(item._id);
    const tally = attendanceByClass.get(key) ?? {
      present: 0,
      absent: 0,
      excuse: 0,
    };

    return {
      ...item,
      id: key,
      childCount: childByClass.get(key) ?? 0,
      monitors: monitorsByClass.get(key) ?? [],
      // `null` et non `0` quand aucune séance n'a été ouverte : « pas
      // encore d'appel » et « zéro présent » sont deux choses très
      // différentes, et les confondre afficherait 0 % un lundi matin.
      sessionId: sessionByClass.get(key) ?? null,
      attendance: sessionByClass.has(key) ? tally : null,
    };
  });

  const childCount = await Child.countDocuments({
    status: "actif",
    ...(church ? { church } : {}),
  });

  const presentToday = items.reduce(
    (total, item) => total + (item.attendance?.present ?? 0),
    0
  );

  const expectedToday = items.reduce(
    (total, item) => (item.attendance ? total + item.childCount : total),
    0
  );

  return {
    childCount,
    classCount: classes.length,
    classes: items,
    today: {
      present: presentToday,
      expected: expectedToday,
      // Aucun appel encore fait : `null` plutôt qu'un taux de 0 %.
      rate:
        expectedToday > 0
          ? Math.round((presentToday / expectedToday) * 100)
          : null,
      sessionCount: sessions.length,
    },
  };
};
