import mongoose from "mongoose";

// Configuration du Service Social, une entrée par église.
//
// Une église SANS document ici n'a pas le module actif : pas de
// génération de cotisations mensuelles, absente des KPIs du dashboard
// et du sélecteur d'église (voir socialContribution.service.js). Le
// document est donc créé à la demande (première configuration depuis
// l'administration), jamais pré-seedé pour les 5 églises — cf. section
// « Décisions de cadrage » de la spec Phase 1.
const socialFundSettingsSchema = new mongoose.Schema(
  {
    church: {
      type: Number,
      required: [true, "L'église est obligatoire."],
      min: 1,
      max: 5,
      unique: true,
    },

    monthlyContributionAmount: {
      type: Number,
      default: 1000,
      min: [0, "Le montant de la cotisation ne peut pas être négatif."],
    },

    // Solde de caisse à l'activation du module pour cette église —
    // reprend l'historique éventuel tenu hors système avant migration.
    openingBalance: {
      type: Number,
      default: 0,
      min: [0, "Le solde initial ne peut pas être négatif."],
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("SocialFundSettings", socialFundSettingsSchema);
