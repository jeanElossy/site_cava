import mongoose from "mongoose";

// Événements de l'église (cultes, formations, camps…).
//
// Le contrat correspond à ce que consomme déjà le front dans
// `src/components/EventDetails/data/events.js` : `slug`, `day`,
// `month`, `dateLong`, `time`, `location`, `image`, `description`,
// `content`, `color`, plus le bloc orateur.
//
// `startAt` est ajouté et fait autorité : les champs `day`/`month`/
// `dateLong` sont de l'affichage, pas de la donnée. Trier ou filtrer
// sur du texte ("15" / "JUIN") serait fragile — on trie sur une vraie
// date et on dérive l'affichage.
const eventSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: [true, "Le slug est obligatoire."],
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
      required: [true, "Le titre est obligatoire."],
      trim: true,
      maxlength: 160,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },

    // Contenu détaillé affiché sur la page de détail.
    content: {
      type: [String],
      default: [],
    },

    startAt: {
      type: Date,
      required: [true, "La date de début est obligatoire."],
    },

    endAt: Date,

    // Horaires affichés tels quels ("08h30", "17h00").
    time: { type: String, trim: true, maxlength: 20 },
    endTime: { type: String, trim: true, maxlength: 20 },

    location: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "CAVA, Abidjan",
    },

    address: { type: String, trim: true, maxlength: 240 },

    audience: { type: String, trim: true, maxlength: 120 },

    theme: { type: String, trim: true, maxlength: 240 },

    // Intervenant : embarqué car il n'a pas de cycle de vie propre
    // et n'est jamais lu sans son événement.
    speaker: {
      name: { type: String, trim: true, maxlength: 120 },
      role: { type: String, trim: true, maxlength: 120 },
      bio: { type: String, trim: true, maxlength: 600 },
    },

    image: { type: String, trim: true },

    // Pastille de couleur de la vignette, cohérente avec le front.
    color: {
      type: String,
      enum: ["green", "yellow"],
      default: "green",
    },

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

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Requête publique type : les événements publiés, du plus proche au
// plus lointain. Index composé plutôt que deux index séparés.
eventSchema.index({ status: 1, startAt: 1 });

eventSchema.statics.upcoming = function (limit = 3) {
  return this.find({
    status: "published",
    startAt: { $gte: new Date() },
  })
    .sort({ startAt: 1 })
    .limit(limit)
    .lean();
};

export default mongoose.model("Event", eventSchema);
