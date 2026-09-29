import Member from "../models/Member.js";
import { normalizeRegistrationNumber } from "../utils/registrationFormat.js";

// Le pont COMPTE → PERSONNE.
//
//   User (compte)  →  registrationNumber  →  Member (personne)
//
// C'est la conséquence directe du choix de ne jamais dupliquer
// l'identité dans ce projet : le compte sert à se connecter, le membre
// EST la personne, et les fonctions (moniteur, responsable de
// bergerie…) vivent à côté des deux.
//
// Cette fonction vivait dans `monitor.service.js`, écrite pour l'École
// du dimanche. Le portail bergerie en a le même besoin, à l'identique.
// Plutôt que de l'importer depuis un module dédié aux moniteurs — ce
// qui aurait fait dépendre les bergeries de l'École du dimanche — ou
// de la recopier, elle est remontée ici, dans un module neutre.
// `monitor.service.js` la ré-exporte, de sorte qu'aucun appelant
// existant n'a changé.
export const findMemberForAccount = async (user) => {
  const registrationNumber = normalizeRegistrationNumber(
    user?.registrationNumber
  );

  if (!registrationNumber) return null;

  return Member.findOne({ registrationNumber }).lean();
};
