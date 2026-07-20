import mongoose from "mongoose";

// Paramètres du site : coordonnées, réseaux sociaux, horaires.
//
// DOCUMENT UNIQUE (singleton). Le champ `key` verrouillé sur "site"
// avec un index unique garantit qu'une seconde ligne ne peut pas être
// créée par erreur — plus fiable que de s'en remettre à la discipline
// des controllers.
//
// Ces valeurs alimenteront le pied de page et la page Contact, qui
// affichent aujourd'hui des coordonnées écrites en dur.
const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "site",
      enum: ["site"],
      unique: true,
      immutable: true,
    },

    churchName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      default: "Centre Apostolique Vie et Abondance",
    },

    phonePrimary: { type: String, trim: true, maxlength: 40 },
    phoneSecondary: { type: String, trim: true, maxlength: 40 },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Adresse e-mail invalide.",
      ],
    },

    address: { type: String, trim: true, maxlength: 300 },

    // Horaires récurrents (cultes hebdomadaires). Distincts des
    // événements datés : ce sont deux notions différentes, les
    // confondre obligerait à recréer un culte chaque semaine.
    serviceTimes: {
      type: [
        {
          _id: false,
          label: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
          },
          day: {
            type: String,
            enum: [
              "lundi",
              "mardi",
              "mercredi",
              "jeudi",
              "vendredi",
              "samedi",
              "dimanche",
            ],
            required: true,
          },
          time: {
            type: String,
            required: true,
            trim: true,
            maxlength: 20,
          },
          description: {
            type: String,
            trim: true,
            maxlength: 300,
          },
        },
      ],
      default: [],
    },

    social: {
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
      youtube: { type: String, trim: true },
      whatsapp: { type: String, trim: true },
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Récupère le document unique, en le créant au premier appel.
settingsSchema.statics.getSite = function () {
  return this.findOneAndUpdate(
    { key: "site" },
    { $setOnInsert: { key: "site" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

export default mongoose.model("Settings", settingsSchema);
