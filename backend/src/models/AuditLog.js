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

    // ⚠️ ENUM FERMÉ, et l'écriture de ce journal avale ses erreurs
    // (voir audit.service.js — un journal indisponible ne doit pas
    // faire échouer l'action métier). Une valeur oubliée ici ne
    // provoque donc AUCUN message : la trace disparaît simplement.
    // Toute nouvelle action doit être ajoutée à cette liste ET
    // couverte par un test qui l'écrit puis la relit.
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
        "2fa_enabled",
        "2fa_disabled",
        "2fa_failed",
        "2fa_recovery_used",
        // ---- Module Enfants ----
        //
        // Les créations, modifications et suppressions ordinaires
        // passent par `create`/`update`/`delete` avec un `resource`
        // distinct (child, childClass, monitorAssignment…). Seules les
        // actions ci-dessous méritent une valeur propre, parce qu'elles
        // répondent à une question qu'aucune autre ne permet de poser.
        //
        // « Qui a consulté l'acte de naissance de cet enfant ? » —
        // exigence explicite pour les documents sensibles, et le seul
        // moyen de détecter une consultation anormale.
        "document_view",
        "document_upload",
        "document_delete",
        // « Cette présence a-t-elle été corrigée après l'appel ? » —
        // distinguer la correction de la saisie initiale, qui est un
        // `create`.
        "attendance_update",
        // « Qui a ouvert cet accès temporaire à une autre classe, et
        // quand a-t-il été retiré ? »
        "substitution_create",
        "substitution_cancel",
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
