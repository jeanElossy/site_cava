// Migration ponctuelle : `PresenceSecurityQr` passe d'une fenêtre
// validFrom/validUntil fixée à la création à une activation paresseuse
// (durationMinutes + activatedAt posé au premier scan — voir
// models/PresenceSecurityQr.js). Les documents déjà en base portent
// encore les anciens champs ; ce script les convertit une fois pour
// toutes :
//   - activatedAt   = ancien validFrom (traité comme "déjà activé à
//                      cet instant" — le plus proche du comportement
//                      réel pour un QR déjà généré avec une fenêtre
//                      fixe)
//   - durationMinutes = (ancien validUntil - ancien validFrom) en minutes
//   - validFrom/validUntil retirés du document (remplacés par le calcul
//     dans utils/presenceQrWindow.js)
//
// Usage : node src/scripts/migrate-presence-qr-activation.js
import "dotenv/config";
import mongoose from "mongoose";

import { env } from "../config/env.js";

const run = async () => {
  await mongoose.connect(env.MONGODB_URI);

  const coll = mongoose.connection.collection("presencesecurityqrs");
  const docs = await coll.find({ validFrom: { $exists: true } }).toArray();

  console.log(`${docs.length} document(s) à migrer.`);

  const MAX_DURATION_MINUTES = 7 * 24 * 60;

  for (const doc of docs) {
    // Borné au plafond du nouveau schéma (7 jours) : une fenêtre
    // d'origine plus longue (vu en production sur un document de test,
    // ~378 jours) ferait échouer toute future validation Mongoose sur
    // ce document (ex. sa révocation).
    const durationMinutes = Math.min(
      MAX_DURATION_MINUTES,
      Math.max(1, Math.round((doc.validUntil - doc.validFrom) / 60000))
    );

    await coll.updateOne(
      { _id: doc._id },
      {
        $set: { activatedAt: doc.validFrom, durationMinutes },
        $unset: { validFrom: "", validUntil: "" },
      }
    );

    console.log(
      `- ${doc._id} (${doc.label}) : activatedAt=${doc.validFrom.toISOString()} durationMinutes=${durationMinutes}`
    );
  }

  await mongoose.disconnect();
  console.log("Migration terminée.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
