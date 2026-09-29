import mongoose from "mongoose";

import Flock from "../models/Flock.js";
import Member from "../models/Member.js";

// Qui a le droit de voir quelle bergerie.
//
// `resolveFlockAccess` est la SEULE fonction du projet qui en décide.
// Le middleware l'appelle, l'écran « ma bergerie » l'appelle, la liste
// des membres l'appellera.
//
// Ce n'est pas une coquetterie d'architecture : le badgeage des
// présences a déjà connu le défaut inverse — trois endroits décidaient
// séparément si un membre était agent habilité, ils ont divergé, et la
// connexion passait pendant que chaque requête suivante échouait.
// C'est aussi la raison d'être de `resolveMonitorAccess`, son
// équivalent pour l'école du dimanche. Une décision, une fonction.
//
// TROIS conditions doivent être réunies, et l'oubli d'une seule ouvre
// un accès qui aurait dû être fermé :
//   - le membre est désigné responsable d'une bergerie ;
//   - sa désignation est « actif » (et non mise en retrait) ;
//   - la bergerie elle-même est publiée (ni brouillon, ni archivée).
//
// S'y ajoute le statut du MEMBRE : un responsable désactivé de
// l'annuaire ne dirige plus rien. Sans cette vérification, désactiver
// quelqu'un de la communauté lui aurait laissé l'accès à la liste
// nominative de ses anciens membres.

const NO_ACCESS = Object.freeze({ flock: null, flockIds: [] });

export const resolveFlockAccess = async (memberId) => {
  if (!memberId || !mongoose.isValidObjectId(memberId)) return NO_ACCESS;

  // Le statut du membre se lit AVANT la bergerie : inutile d'interroger
  // la seconde si le premier n'est plus actif.
  const member = await Member.findOne({
    _id: memberId,
    status: "actif",
  })
    .select("_id")
    .lean();

  if (!member) return NO_ACCESS;

  const flock = await Flock.findOne({
    leader: memberId,
    leaderStatus: "actif",
    status: "published",
  })
    .select("code name church status leader leaderStatus leaderSince")
    .lean();

  if (!flock) return NO_ACCESS;

  return {
    flock,
    // Un TABLEAU alors qu'il n'y a qu'une bergerie : les appelants
    // filtrent avec `$in`, et le jour où le coordinateur des bergeries
    // passera par la même fonction — il les voit toutes — aucun d'eux
    // n'aura à changer.
    flockIds: [String(flock._id)],
  };
};

// Un responsable ne voit que SES membres. Ce filtre est composé côté
// serveur et n'est jamais lu depuis la requête : un filtre passé en
// paramètre d'URL se réécrit d'un clic dans la barre d'adresse, et le
// responsable de la bergerie OL verrait la liste nominative de la
// bergerie ME.
export const memberFilterFor = ({ flockIds }) => {
  if (!flockIds?.length) {
    // Aucune bergerie : un filtre IMPOSSIBLE à satisfaire, et non un
    // filtre vide. Un objet vide aurait renvoyé TOUS les membres —
    // exactement l'inverse de ce qu'on veut, et en silence.
    return { _id: { $in: [] } };
  }

  return { flock: { $in: flockIds } };
};
