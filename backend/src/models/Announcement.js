import mongoose from "mongoose";

// Annonces de la communauté, affichées sur la page /communaute.
const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    // Catégorie affichée en pastille sur la page Communauté.
    //
    // Ce champ manquait au modèle alors que le composant public
    // l'affiche déjà (`CATEGORY_LABELS[item.category]`) et que le
    // formulaire d'administration le proposait : la valeur saisie était
    // donc rejetée en silence par Mongoose, et la pastille retombait
    // systématiquement sur « Information ».
    category: {
      type: String,
      enum: ["info", "priere", "evenement", "service"],
      default: "info",
      index: true,
    },

    // Mise en avant en tête de page.
    pinned: { type: Boolean, default: false },

    // Fenêtre de publication : une annonce peut être programmée et
    // expirer d'elle-même, sans intervention de l'administration.
    publishedAt: { type: Date, default: Date.now },
    expiresAt: Date,

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

announcementSchema.index({
  status: 1,
  pinned: -1,
  publishedAt: -1,
});

// Annonces réellement visibles maintenant : publiées, dont la date de
// publication est passée et qui n'ont pas expiré.
announcementSchema.statics.visible = function () {
  const now = new Date();

  return this.find({
    status: "published",
    publishedAt: { $lte: now },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ],
  })
    .sort({ pinned: -1, publishedAt: -1 })
    .lean();
};

export default mongoose.model(
  "Announcement",
  announcementSchema
);
