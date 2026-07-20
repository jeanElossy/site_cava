import mongoose from "mongoose";

// Ministères de l'église.
//
// Choix de modélisation : responsables, galerie, statistiques et
// témoignages sont EMBARQUÉS. Ils n'ont pas de sens hors de leur
// ministère, sont toujours lus avec lui, et restent en petit nombre
// (une poignée par ministère, curés par l'administration).
//
// En revanche les ÉVÉNEMENTS sont RÉFÉRENCÉS : un événement existe
// indépendamment, est déjà exposé sur /events, et serait sinon
// dupliqué à deux endroits — le défaut exact que CLAUDE.md signale
// aujourd'hui côté front.

const leaderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    role: { type: String, trim: true, maxlength: 120 },
    bio: { type: String, trim: true, maxlength: 400 },
    image: { type: String, trim: true },
  },
  { _id: false }
);

const statSchema = new mongoose.Schema(
  {
    icon: {
      type: String,
      enum: ["users", "calendar", "leaders", "star"],
      default: "users",
    },
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
  },
  { _id: false }
);

const testimonialSchema = new mongoose.Schema(
  {
    author: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    quote: {
      type: String,
      required: true,
      trim: true,
      maxlength: 600,
    },
    rating: { type: Number, min: 1, max: 5, default: 5 },
  },
  { _id: false }
);

const ministrySchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Le slug ne peut contenir que des minuscules, des chiffres et des tirets.",
      ],
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },

    image: { type: String, trim: true },

    color: {
      type: String,
      enum: ["green", "gold"],
      default: "green",
    },

    mission: {
      title: { type: String, trim: true, maxlength: 120 },
      description: {
        type: String,
        trim: true,
        maxlength: 800,
      },
    },

    vision: {
      title: { type: String, trim: true, maxlength: 120 },
      description: {
        type: String,
        trim: true,
        maxlength: 800,
      },
    },

    // Bornés volontairement : au-delà, c'est le signe qu'il faut une
    // collection dédiée plutôt qu'un document qui enfle.
    stats: {
      type: [statSchema],
      validate: {
        validator: (v) => v.length <= 8,
        message: "8 statistiques maximum par ministère.",
      },
      default: [],
    },

    leaders: {
      type: [leaderSchema],
      validate: {
        validator: (v) => v.length <= 20,
        message: "20 responsables maximum par ministère.",
      },
      default: [],
    },

    gallery: {
      type: [String],
      validate: {
        validator: (v) => v.length <= 30,
        message: "30 images maximum par ministère.",
      },
      default: [],
    },

    testimonials: {
      type: [testimonialSchema],
      validate: {
        validator: (v) => v.length <= 20,
        message: "20 témoignages maximum par ministère.",
      },
      default: [],
    },

    // Référence : un événement a un cycle de vie indépendant.
    events: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],

    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Adresse e-mail invalide.",
      ],
    },

    // Ordre d'affichage sur la page Ministères.
    order: { type: Number, default: 0 },

    // Publié par défaut : un contenu créé depuis l'administration doit
    // apparaître sur le site sans manipulation supplémentaire. Les
    // statuts « draft » et « archived » restent disponibles pour
    // masquer volontairement un contenu — sans jamais le supprimer.
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
      index: true,
    },
  },
  { timestamps: true }
);

ministrySchema.index({ status: 1, order: 1 });

export default mongoose.model("Ministry", ministrySchema);
