import mongoose from "mongoose";

// Historique de connexion d'un agent de badgeage — QUI s'est connecté,
// QUAND, avec QUEL QR de sécurité. Alimente l'écran admin « historique
// d'usage » d'un QR (voir 2026-08-04-badgeage-presences-design.md).
//
// Distinct d'`AuditLog` : ce journal porte des connexions de `Member`
// (les agents de badgeage), pas d'actions de `User` (les administrateurs).
const presenceLoginSchema = new mongoose.Schema(
  {
    securityQr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PresenceSecurityQr",
      required: true,
      index: true,
    },

    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    loggedInAt: {
      type: Date,
      default: Date.now,
    },

    ip: { type: String, trim: true, maxlength: 60 },
    userAgent: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: false }
);

presenceLoginSchema.index({ securityQr: 1, loggedInAt: -1 });

export default mongoose.model("PresenceLogin", presenceLoginSchema);
