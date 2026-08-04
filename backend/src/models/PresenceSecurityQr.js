import crypto from "node:crypto";

import mongoose from "mongoose";

// QR de sécurité du badgeage des présences.
//
// Généré depuis l'administration pour un service donné (culte,
// veillée…), imprimé et affiché dans la salle du Service d'Ordre. Un
// agent le scanne pour accéder au scanner de présence — voir
// `presence.service.js` et docs/superpowers/specs/2026-08-04-badgeage-
// presences-design.md.
//
// CE QUE CE DOCUMENT NE PORTE PAS : la validité n'est jamais tranchée
// par le jeton JWT encodé sur le QR (voir `presenceAuth.js`), toujours
// par CE document — `status` et la fenêtre `validFrom`/`validUntil`.
// C'est ce qui permet à un administrateur de révoquer un QR déjà
// imprimé et déjà scanné : le jeton reste cryptographiquement valide,
// mais l'accès est refusé dès la prochaine vérification.
const presenceSecurityQrSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: [true, "Le libellé est obligatoire."],
      trim: true,
      maxlength: 160,
    },

    // Lien de confort uniquement (pré-remplissage du libellé/horaire
    // depuis l'administration) : un service badgé n'a pas toujours de
    // fiche `Event` correspondante.
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },

    validFrom: {
      type: Date,
      required: [true, "Le début de validité est obligatoire."],
    },

    validUntil: {
      type: Date,
      required: [true, "La fin de validité est obligatoire."],
      validate: {
        validator: function (value) {
          return !this.validFrom || value > this.validFrom;
        },
        message: "La fin de validité doit être postérieure au début.",
      },
    },

    // Identifiant opaque embarqué dans le JWT — jamais le seul
    // identifiant Mongo, pour ne pas exposer d'ObjectId prévisible sur
    // un document imprimé et affiché publiquement dans une salle.
    jti: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(24).toString("hex"),
    },

    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
      index: true,
    },

    revokedAt: Date,
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

presenceSecurityQrSchema.index({ validFrom: -1 });

export default mongoose.model("PresenceSecurityQr", presenceSecurityQrSchema);
