import mongoose from "mongoose";

// Moyen de paiement Mobile Money de l'église (Orange Money, MTN
// Money, Moov Money, Wave...). Remplace l'ancien enum `paymentMethod`
// codé en dur dans Donation : un numéro qui change ou un nouvel
// opérateur ne demandent plus de toucher au code, seulement à
// l'administration.
//
// `active: false` par défaut : un moyen fraîchement créé n'a pas
// encore de QR ni de numéro renseignés, et ne doit jamais apparaître
// aux fidèles tant que l'administrateur ne l'a pas explicitement
// activé.
const paymentMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom du moyen de paiement est obligatoire."],
      trim: true,
      maxlength: 60,
    },

    image: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },

    accountNumber: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "",
    },

    holderName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },

    active: { type: Boolean, default: false },

    // Ordre d'affichage dans le tunnel de don, plus petit en premier.
    order: { type: Number, default: 0 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

paymentMethodSchema.index({ active: 1, order: 1 });

export default mongoose.model("PaymentMethod", paymentMethodSchema);
