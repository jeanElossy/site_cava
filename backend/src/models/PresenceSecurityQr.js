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
// par CE document — `status` et la fenêtre de validité. C'est ce qui
// permet à un administrateur de révoquer un QR déjà imprimé et déjà
// scanné : le jeton reste cryptographiquement valide, mais l'accès est
// refusé dès la prochaine vérification.
//
// ACTIVATION PARESSEUSE : un QR peut être généré et imprimé bien avant
// le jour J (plusieurs à la fois, pour plusieurs services à venir),
// sans dates de validité figées à la création — seulement une DURÉE
// (`durationMinutes`). La fenêtre réelle ne démarre qu'au tout premier
// scan réussi, qui pose `activatedAt` une fois pour toutes (voir
// `presenceQr.service.js#verifyToken` et `utils/presenceQrWindow.js`
// pour le calcul de la fenêtre effective). Tant que `activatedAt` est
// vide, le QR est simplement "en attente" — il reste imprimable et
// dépose sans qu'aucune horloge ne tourne encore.
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

    // Durée de validité à partir de l'ACTIVATION (premier scan), pas
    // depuis la création — voir le calcul dans utils/presenceQrWindow.js.
    // Plafond généreux (7 jours) : garde-fou contre une saisie erronée
    // (ex. minutes tapées à la place d'heures), pas une limite métier.
    durationMinutes: {
      type: Number,
      required: [true, "La durée de validité est obligatoire."],
      min: [1, "La durée doit être d'au moins 1 minute."],
      max: [7 * 24 * 60, "La durée ne peut pas dépasser 7 jours."],
    },

    // Optionnel : empêche l'activation avant cette date/heure, même si
    // quelqu'un scanne le QR par erreur ou par curiosité avant le jour
    // prévu (un QR préimprimé et déposé à l'avance reste scannable en
    // pratique). Laissé vide, le QR est activable dès sa création.
    notBefore: Date,

    // Posé UNE SEULE FOIS, au tout premier scan réussi — jamais modifié
    // ensuite. `null` = QR encore "en attente", jamais scanné.
    activatedAt: {
      type: Date,
      default: null,
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

presenceSecurityQrSchema.index({ createdAt: -1 });

export default mongoose.model("PresenceSecurityQr", presenceSecurityQrSchema);
