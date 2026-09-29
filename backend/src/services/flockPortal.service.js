import Member from "../models/Member.js";
import { memberFilterFor } from "./flockAccess.service.js";

// Lectures du portail bergerie.
//
// ------------------------------------------------------------------
// LECTURE SEULE, ET C'EST UNE DÉCISION
// ------------------------------------------------------------------
// Un responsable de bergerie CONSULTE ses membres, il ne les modifie
// pas. Écrire des données personnelles depuis un compte de terrain
// aurait changé la nature du portail — et sa revue de sécurité. Ce
// module n'expose donc aucune fonction d'écriture ; il n'y a rien à
// désactiver, il n'y a rien.
//
// ------------------------------------------------------------------
// LE FILTRE VIENT DE L'ACCÈS, JAMAIS DE LA REQUÊTE
// ------------------------------------------------------------------
// Chaque fonction reçoit l'objet `access` posé par `requireFlockLeader`
// et compose son filtre avec `memberFilterFor`. Aucune ne lit d'
// identifiant de bergerie dans les paramètres : celui-ci se réécrit
// d'un clic dans la barre d'adresse.

// Champs renvoyés au responsable. Liste EXPLICITE, et volontairement
// courte : `notes` (notes internes de l'équipe pastorale) est
// `select: false` au modèle, mais compter là-dessus reviendrait à
// faire dépendre la confidentialité d'un réglage lointain. Ce qui
// n'est pas nommé ici ne sort pas.
const MEMBER_FIELDS = [
  "firstName",
  "lastName",
  "registrationNumber",
  "registrationOrder",
  "church",
  "phone",
  "whatsapp",
  "email",
  "area",
  "gender",
  "dateOfBirth",
  "photo",
  "role",
  "status",
  "joinedAt",
].join(" ");

export const listMembers = async (access, { page = 1, limit = 25 } = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);

  const criteria = {
    ...memberFilterFor(access),
    // Les membres désactivés n'apparaissent pas : le portail sert à
    // suivre la bergerie vivante, pas à consulter un historique.
    status: "actif",
  };

  const [items, total] = await Promise.all([
    Member.find(criteria)
      .select(MEMBER_FIELDS)
      // Même ordre que l'annuaire d'administration : rang réel
      // d'inscription, extrait du matricule. Retrier côté navigateur
      // ne réordonnerait que la page affichée et ferait « sauter » les
      // matricules d'une page à l'autre.
      .sort({ registrationOrder: 1, lastName: 1, firstName: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Member.countDocuments(criteria),
  ]);

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(Math.ceil(total / safeLimit), 1),
    },
  };
};

// Tableau de bord : ce que le responsable voit en arrivant.
export const summary = async (access) => {
  const filter = memberFilterFor(access);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [actifs, inactifs, arriveesDuMois] = await Promise.all([
    Member.countDocuments({ ...filter, status: "actif" }),
    Member.countDocuments({ ...filter, status: "inactif" }),
    Member.countDocuments({
      ...filter,
      status: "actif",
      joinedAt: { $gte: startOfMonth },
    }),
  ]);

  return {
    flock: {
      id: String(access.flock._id),
      code: access.flock.code,
      name: access.flock.name,
      church: access.flock.church,
    },
    actifs,
    inactifs,
    arriveesDuMois,
  };
};
