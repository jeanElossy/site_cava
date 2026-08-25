import mongoose from "mongoose";

// Mouvement de caisse du Service Social, écrit automatiquement par le
// service métier — jamais saisi manuellement (pas de saisie libre
// d'écriture de caisse).
//
// Le solde d'une caisse à un instant T se recalcule TOUJOURS côté
// backend par agrégation Mongo (openingBalance de l'exercice + somme
// des entrées de cette église POUR CET EXERCICE) — jamais mis en
// cache comme source de vérité. Voir
// socialFundYear.service.js#computeYearBalance().
const socialLedgerEntrySchema = new mongoose.Schema(
  {
    church: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    // Exercice (année civile) auquel ce mouvement est rattaché — voir
    // SocialFundYear.js pour la règle : c'est l'année de la DATE
    // D'ENREGISTREMENT, pas celle du mois cotisé.
    //
    // Dénormalisé plutôt que déduit de `createdAt` à la lecture : le
    // filtrage et l'agrégation par exercice sont l'opération la plus
    // fréquente du module (caisse, dashboard, contrôle de solde avant
    // décaissement), et un `$expr: { $year: "$createdAt" }` ne saurait
    // pas utiliser d'index.
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
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
    // somme(amount)) n'a besoin d'aucune modification : c'était déjà
    // une simple somme signée, seul le signe des nouvelles écritures
    // change.
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

// Sert les deux requêtes chaudes de la caisse annuelle : la liste
// paginée des mouvements d'un exercice, et l'agrégation de son solde.
socialLedgerEntrySchema.index({ church: 1, year: 1, createdAt: -1 });

export default mongoose.model("SocialLedgerEntry", socialLedgerEntrySchema);
