import mongoose from "mongoose";

// Présence enregistrée lors d'un service badgé.
//
// IDEMPOTENCE — l'index unique composé ci-dessous est ce qui garantit
// qu'un même membre ne peut avoir qu'UNE présence par QR de sécurité,
// quel que soit le nombre de fois où sa carte est scannée pendant le
// service. `presence.service.js` s'appuie dessus (upsert) plutôt que
// de vérifier « à la main » avant d'écrire — évite toute fenêtre de
// concurrence entre deux scans presque simultanés.
const attendanceSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    // Porte le libellé et la fenêtre horaire du service — voir
    // PresenceSecurityQr. Une présence n'a pas de sens hors d'un
    // service badgé, donc pas de valeur par défaut.
    securityQr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PresenceSecurityQr",
      required: true,
    },

    // Agent qui a enregistré la présence (pas forcément celui connecté
    // au moment du scan initial de session, mais en pratique le même).
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    method: {
      type: String,
      enum: ["scan", "manual"],
      required: true,
    },

    recordedAt: {
      type: Date,
      default: Date.now,
    },

    ip: { type: String, trim: true, maxlength: 60 },
    userAgent: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: false }
);

attendanceSchema.index({ member: 1, securityQr: 1 }, { unique: true });
attendanceSchema.index({ securityQr: 1, recordedAt: -1 });

export default mongoose.model("Attendance", attendanceSchema);
