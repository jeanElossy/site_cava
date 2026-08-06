import mongoose from "mongoose";

// Type de don (Dîme, Offrande, Action de grâce, Construction,
// Mission, Don libre...). Remplace l'ancien enum `contributionType`
// codé en dur dans Donation — un besoin qui apparaît (une nouvelle
// campagne de construction, par exemple) devient une entrée
// d'administration plutôt qu'un déploiement.
//
// `active: true` par défaut, contrairement à PaymentMethod : un type
// de don n'a pas de dépendance externe (QR, numéro) à renseigner
// avant de pouvoir être proposé.
const donationTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom du type de don est obligatoire."],
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

donationTypeSchema.index({ active: 1, order: 1 });

export default mongoose.model("DonationType", donationTypeSchema);
