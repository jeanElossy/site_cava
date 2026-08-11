import mongoose from "mongoose";

// Mouvement de caisse du Service Social, écrit automatiquement par le
// service métier — jamais saisi manuellement (pas de saisie libre
// d'écriture de caisse).
//
// Le solde de caisse d'une église à un instant T se recalcule TOUJOURS
// côté backend par agrégation Mongo (openingBalance + somme des
// entrées de cette église) — jamais mis en cache comme source de
// vérité. Voir socialContribution.service.js#computeCashBalance().
const socialLedgerEntrySchema = new mongoose.Schema(
  {
    church: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    // Étendu en Phase 2 : "aide" (décaissement) et "aide_annulation"
    // (écriture de compensation d'une aide annulée), en plus de
    // "cotisation" (Phase 1).
    type: {
      type: String,
      enum: ["cotisation", "aide", "aide_annulation"],
      required: true,
    },

    // Reprend la référence de l'opération source (la `reference` de la
    // `SocialContribution` ou de la `SocialAid` qui a généré ce
    // mouvement).
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

    // Signé depuis la Phase 2 : positif pour une entrée (cotisation,
    // compensation d'annulation d'aide), négatif pour une sortie
    // (décaissement d'une aide). Le calcul de solde (openingBalance +
    // somme(amount), voir computeCashBalance()) n'a besoin d'aucune
    // modification : c'était déjà une simple somme signée, seul le
    // signe des nouvelles écritures change.
    amount: {
      type: Number,
      required: true,
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
