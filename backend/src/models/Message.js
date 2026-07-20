import mongoose from "mongoose";

// Messages envoyés par les visiteurs via le formulaire de contact.
//
// ATTENTION — DONNÉES PERSONNELLES
// Cette collection contient nom, e-mail et parfois des situations
// personnelles (demandes de prière). Trois conséquences directes :
//   - le consentement est enregistré et horodaté ;
//   - une durée de conservation doit être appliquée (voir l'index TTL
//     commenté en bas de fichier), en cohérence avec la politique de
//     confidentialité du site ;
//   - l'accès doit être réservé aux administrateurs authentifiés.

const replySchema = new mongoose.Schema(
  {
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Distingue « réponse rédigée » de « réponse réellement envoyée ».
    // Sans ce champ, on ne saurait pas si le visiteur a reçu quelque
    // chose — c'est exactement l'ambiguïté que l'admin actuel signale.
    sentAt: Date,

    deliveryError: { type: String, trim: true },
  },
  { timestamps: true, _id: true }
);

const messageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom est obligatoire."],
      trim: true,
      maxlength: 120,
    },

    email: {
      type: String,
      required: [true, "L'e-mail est obligatoire."],
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Adresse e-mail invalide.",
      ],
    },

    phone: { type: String, trim: true, maxlength: 40 },

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    body: {
      type: String,
      required: [true, "Le message est obligatoire."],
      trim: true,
      maxlength: 5000,
    },

    // Permet de router les demandes de prière vers l'équipe dédiée.
    kind: {
      type: String,
      enum: ["contact", "priere", "ministere", "autre"],
      default: "contact",
      index: true,
    },

    // Renseigné quand la demande concerne un ministère précis.
    ministry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ministry",
    },

    status: {
      type: String,
      enum: ["nouveau", "lu", "repondu", "archive"],
      default: "nouveau",
    },

    // Preuve du consentement, exigée par la politique de
    // confidentialité. Non modifiable après création.
    consent: {
      type: Boolean,
      required: true,
      validate: {
        validator: (v) => v === true,
        message:
          "Le consentement est obligatoire pour enregistrer un message.",
      },
    },

    consentAt: { type: Date, default: Date.now },

    // Réponses embarquées : quelques-unes au plus par message, jamais
    // lues sans leur message parent.
    replies: {
      type: [replySchema],
      validate: {
        validator: (v) => v.length <= 50,
        message: "50 réponses maximum par message.",
      },
      default: [],
    },
  },
  { timestamps: true }
);

// Requête type de la boîte de réception : les non-lus d'abord, du plus
// récent au plus ancien.
messageSchema.index({ status: 1, createdAt: -1 });

// CONSERVATION DES DONNÉES — à activer une fois la durée arbitrée
// avec le client et inscrite dans la politique de confidentialité
// (c'est l'un des champs encore à compléter sur le site).

// Exemple pour une purge automatique à 24 mois :
messageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 730 }
);

export default mongoose.model("Message", messageSchema);
