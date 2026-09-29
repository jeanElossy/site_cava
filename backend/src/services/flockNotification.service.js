import Flock from "../models/Flock.js";
import Member from "../models/Member.js";
import User from "../models/User.js";
import * as pushService from "./push.service.js";

// Prévenir le responsable d'une bergerie.
//
// ------------------------------------------------------------------
// TROIS MAILLONS, ET CHACUN PEUT MANQUER
// ------------------------------------------------------------------
//   Flock.leader  →  Member  →  registrationNumber  →  User (compte)
//
// Une bergerie peut n'avoir aucun responsable ; un responsable
// désigné peut n'avoir pas encore de compte ; son compte peut être
// désactivé. Aucun de ces cas n'est une anomalie — ils sont l'état
// normal d'une mise en place progressive. La fonction renvoie donc
// `null` sans bruit plutôt que de lever.
export const findLeaderAccountForFlock = async (flockId) => {
  if (!flockId) return null;

  const flock = await Flock.findOne({
    _id: flockId,
    leaderStatus: "actif",
    status: "published",
  })
    .select("leader")
    .lean();

  if (!flock?.leader) return null;

  const member = await Member.findOne({ _id: flock.leader, status: "actif" })
    .select("registrationNumber")
    .lean();

  if (!member?.registrationNumber) return null;

  // Le rôle est vérifié ICI et pas seulement à la connexion : un
  // ancien responsable dont le compte a changé de rôle ne doit plus
  // recevoir les nouvelles de la bergerie, même si la désignation
  // n'a pas encore été retirée.
  return User.findOne({
    registrationNumber: member.registrationNumber,
    role: "responsable_bergerie",
    isActive: true,
  })
    .select("_id")
    .lean();
};

// Un nouveau membre rejoint la bergerie (clôture d'un dossier CANA).
//
// VOLONTAIREMENT NON ATTENDUE par l'appelant (pas de `await` au point
// d'appel) : une notification ne doit jamais retarder — ni faire
// échouer — la clôture du dossier, qui vient de créer un membre et
// son matricule. Même convention que `notifyNewDossier` et
// `notifyTransmission` dans newSoul.service.js.
//
// `push.service.js` garantit de son côté de ne jamais lever ; le
// `catch` ci-dessous couvre le reste du chemin (lecture des trois
// maillons), pour que cette promesse non attendue ne puisse pas
// devenir un rejet non capturé.
export const notifyNewMemberInFlock = async (flockId, member) => {
  try {
    const account = await findLeaderAccountForFlock(flockId);

    if (!account) return;

    const name = `${member?.firstName ?? ""} ${member?.lastName ?? ""}`.trim();

    await pushService.sendToUser(account._id, {
      title: "Un nouveau membre dans votre bergerie",
      body: name || "Une nouvelle fiche vient d'être créée.",
      url: "/admin/bergerie",
    });
  } catch (error) {
    console.error(
      "[bergerie] notification du responsable impossible :",
      error.message
    );
  }
};
