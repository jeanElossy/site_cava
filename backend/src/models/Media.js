import mongoose from "mongoose";

// Médias : messages, louanges, témoignages.
//
// Le sous-document `video` reprend EXACTEMENT le contrat déjà en place
// côté front (`src/components/Media/data/medias.js`) :
//
//   { kind: "youtube", id }   → lecture sur le site (iframe)
//   { kind: "file",    src }  → lecture sur le site (fichier hébergé)
//   { kind: "link",    url }  → ouverture dans un nouvel onglet
//   null                      → aucune vidéo rattachée
//
// La validation croisée ci-dessous garantit que le champ attendu par
// chaque type est bien présent. Sans elle, l'administration pourrait
// enregistrer un `kind: "youtube"` sans identifiant, et la page
// Médias afficherait un lecteur vide.
const videoSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["youtube", "file", "link"],
      required: true,
    },

    // Identifiant YouTube (la partie après `watch?v=`).
    id: {
      type: String,
      trim: true,
      match: [
        /^[A-Za-z0-9_-]{11}$/,
        "Identifiant YouTube invalide (11 caractères attendus).",
      ],
    },

    // Chemin d'un fichier hébergé par nos soins.
    src: { type: String, trim: true },

    // URL externe complète.
    url: { type: String, trim: true },
  },
  { _id: false }
);

videoSchema.pre("validate", function (next) {
  const required = {
    youtube: "id",
    file: "src",
    link: "url",
  }[this.kind];

  if (required && !this[required]) {
    return next(
      new Error(
        `Une vidéo de type « ${this.kind} » doit renseigner le champ « ${required} ».`
      )
    );
  }

  next();
});

const mediaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    // Prédicateur, groupe de louange ou auteur du témoignage.
    author: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    category: {
      type: String,
      enum: ["message", "louange", "temoignage"],
      required: true,
      index: true,
    },

    // Date de la prédication / publication. Fait autorité pour le tri.
    publishedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Durée affichée telle quelle ("45:30").
    duration: {
      type: String,
      trim: true,
      match: [
        /^\d{1,2}:\d{2}(:\d{2})?$/,
        "Durée attendue au format mm:ss ou hh:mm:ss.",
      ],
    },

    // Vignette. Obligatoire : une carte sans image casse la grille.
    image: {
      type: String,
      required: true,
      trim: true,
    },

    // `default: null` volontaire : c'est un état valide et documenté,
    // pas une donnée manquante.
    video: {
      type: videoSchema,
      default: null,
    },

    // Publié par défaut : un contenu créé depuis l'administration doit
    // apparaître sur le site sans manipulation supplémentaire. Les
    // statuts « draft » et « archived » restent disponibles pour
    // masquer volontairement un contenu — sans jamais le supprimer.
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Requête publique type : les médias publiés d'une catégorie, du plus
// récent au plus ancien.
mediaSchema.index({ status: 1, category: 1, publishedAt: -1 });

export default mongoose.model("Media", mediaSchema);
