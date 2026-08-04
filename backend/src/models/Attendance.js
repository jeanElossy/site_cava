import mongoose from "mongoose";

// Présence enregistrée lors d'un service badgé — un membre (carte
// scannée ou retrouvé via « carte oubliée ») ou un visiteur sans
// dossier `Member` (voir presence.service.js#markVisitor).
//
// IDEMPOTENCE — l'index unique composé ci-dessous garantit qu'un même
// MEMBRE ne peut avoir qu'UNE présence par QR de sécurité, quel que
// soit le nombre de fois où sa carte est scannée pendant le service.
// `presence.service.js` s'appuie dessus (upsert) plutôt que de
// vérifier « à la main » avant d'écrire — évite toute fenêtre de
// concurrence entre deux scans presque simultanés.
//
// Un visiteur n'a pas d'identité stable d'un service à l'autre (pas de
// matricule, pas de compte) : rien ne permettrait de le dédupliquer de
// façon fiable, donc aucune contrainte d'unicité ne s'applique à lui —
// c'est pourquoi l'index ci-dessous est un index PARTIEL, restreint
// aux documents `kind: "member"`.
const attendanceSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["member", "visitor"],
      required: true,
      default: "member",
    },

    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      // Chemin imbriqué en objet simple (pas un sous-document via sa
      // propre Schema) : `this` désigne ici le document racine, donc
      // `this.kind` est directement accessible.
      required: [
        function () {
          return this.kind === "member";
        },
        "Le membre est obligatoire pour une présence de type « membre ».",
      ],
    },

    // Identité déclarée par l'agent pour un visiteur sans carte — texte
    // libre, jamais rapprochée d'un `Member` existant.
    visitor: {
      firstName: {
        type: String,
        trim: true,
        maxlength: 80,
        required: [
          function () {
            return this.kind === "visitor";
          },
          "Le prénom est obligatoire pour une présence de type « visiteur ».",
        ],
      },
      lastName: {
        type: String,
        trim: true,
        maxlength: 80,
        required: [
          function () {
            return this.kind === "visitor";
          },
          "Le nom est obligatoire pour une présence de type « visiteur ».",
        ],
      },
      phone: { type: String, trim: true, maxlength: 40 },
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

attendanceSchema.index(
  { member: 1, securityQr: 1 },
  { unique: true, partialFilterExpression: { kind: "member" } }
);
attendanceSchema.index({ securityQr: 1, recordedAt: -1 });

export default mongoose.model("Attendance", attendanceSchema);
