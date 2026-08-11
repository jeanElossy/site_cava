import mongoose from "mongoose";

// Mouvement de caisse du Service Social, écrit automatiquement par le
// service métier — jamais saisi manuellement en Phase 1 (pas de saisie
// libre d'écriture de caisse, pas de sortie).
//
// Le solde de caisse d'une église à un instant T se recalcule TOUJOURS
// côté backend par agrégation Mongo (openingBalance + somme des
// entrées de cette église) — jamais mis en cache comme source de
// vérité. Voir socialContribution.service.js#caisse().
const socialLedgerEntrySchema = new mongoose.Schema(
  {
    church: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    // Enum délibérément restreint à une seule valeur en Phase 1
    // (aucune sortie de caisse, pas d'aide sociale) — sera étendu en
    // Phase 2 (ex. "aide").
    type: {
      type: String,
      enum: ["cotisation"],
      required: true,
    },

    // Reprend la référence de l'opération source (la `reference` de la
    // `SocialContribution` qui a généré ce mouvement).
    reference: {
      type: String,
      trim: true,
      maxlength: 60,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    // Toujours positif en Phase 1 (aucune sortie) ; deviendra signé en
    // Phase 2.
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

socialLedgerEntrySchema.index({ church: 1, createdAt: -1 });

export default mongoose.model("SocialLedgerEntry", socialLedgerEntrySchema);
