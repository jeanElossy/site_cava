import mongoose from "mongoose";

// Journal des actions d'administration.
//
// POURQUOI : sans trace, une compromission ne laisse aucun moyen de
// savoir ce qui a été modifié, quand, ni par qui. On ne peut alors ni
// mesurer l'étendue des dégâts ni restaurer sélectivement.
//
// Ce journal enregistre QUI a fait QUOI et SUR QUOI — jamais le
// contenu détaillé des modifications : cela dupliquerait des données
// personnelles (messages de visiteurs, notes pastorales) dans une
// seconde collection, en multipliant la surface d'exposition.
const auditLogSchema = new mongoose.Schema(
  {
    // Non obligatoire : un échec de connexion n'a pas d'utilisateur
    // authentifié, mais mérite d'être tracé — c'est même le cas le
    // plus intéressant pour détecter une attaque.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // Dénormalisé volontairement : si le compte est supprimé plus
    // tard, la trace doit rester lisible.
    actorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    action: {
      type: String,
      enum: [
        "login",
        "login_failed",
        "create",
        "update",
        "delete",
        "reply",
        "settings_update",
        "password_change",
      ],
      required: true,
      index: true,
    },

    resource: { type: String, trim: true, maxlength: 60 },

    resourceId: { type: String, trim: true, maxlength: 60 },

    // Adresse IP à l'origine de l'action. C'est une donnée
    // personnelle : sa conservation est bornée par l'index TTL
    // ci-dessous.
    ip: { type: String, trim: true, maxlength: 60 },

    userAgent: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

// Conservation : 12 mois. Un journal de sécurité doit couvrir une
// période suffisante pour enquêter, sans devenir lui-même un stock
// de données personnelles indéfini.
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 }
);

export default mongoose.model("AuditLog", auditLogSchema);
