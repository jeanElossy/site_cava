import mongoose from "mongoose";

// Type d'aide sociale (Décès, Naissance, Maladie, Aide sociale,
// Urgence, Exceptionnelle, Autre...) — ressource CRUD configurable,
// calquée sur DonationType.js plutôt qu'un enum figé sur SocialAid :
// une nouvelle catégorie devient une entrée d'administration plutôt
// qu'un déploiement. Voir
// docs/superpowers/specs/2026-08-11-service-social-phase2-design.md.
//
// `active: true` par défaut, comme DonationType : un type d'aide n'a
// pas de dépendance externe (QR, numéro) à renseigner avant de pouvoir
// être proposé.
const socialAidTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom du type d'aide est obligatoire."],
      trim: true,
      maxlength: 60,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },

    active: { type: Boolean, default: true },

    order: { type: Number, default: 0 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

socialAidTypeSchema.index({ active: 1, order: 1 });

export default mongoose.model("SocialAidType", socialAidTypeSchema);
