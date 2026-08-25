import mongoose from "mongoose";

const exemptionSchema = new mongoose.Schema(
  {
    motif: { type: String, trim: true, maxlength: 300 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    at: Date,
  },
  { _id: false }
);

// Une ligne = un membre × un mois × une année.
//
// Générée automatiquement par le job quotidien
// (socialContributionsGenerator.js) pour chaque membre actif d'une
// église dotée de `SocialFundSettings`, au montant en vigueur à cet
// instant — voir generateDueContributions().
//
// « En retard » n'est PAS un statut stocké : c'est une valeur dérivée
// au moment de la requête (status dans [non_paye, partiel] ET
// (year, month) strictement antérieur au mois courant). Voir
// listUnpaid() dans le service. Cela évite un état à resynchroniser à
// chaque changement de mois.
const socialContributionSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    // Dénormalisés depuis le membre au moment de la génération, pour
    // filtrer les tableaux sans populate systématique.
    church: {
      type: Number,
      min: 1,
      max: 5,
    },

    flock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flock",
    },

    year: {
      type: Number,
      required: true,
    },

    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    // Figé au montant `SocialFundSettings` en vigueur au moment de la
    // génération de la ligne — un changement de tarif plus tard ne
    // doit jamais réécrire une ligne déjà émise.
    amountDue: {
      type: Number,
      required: true,
      min: 0,
    },

    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["non_paye", "paye", "partiel", "exonere", "annule"],
      default: "non_paye",
      index: true,
    },

    // Absente tant que la ligne n'est pas payée — assignée au moment
    // du premier paiement, réutilisée si un paiement partiel est
    // complété plus tard (voir recordPayments()).
    reference: {
      type: String,
      unique: true,
      sparse: true,
    },

    paidAt: Date,

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Présent seulement si status === "exonere".
    exemption: {
      type: exemptionSchema,
      default: undefined,
    },

    // Présent seulement si status === "annule" — une correction annule
    // la ligne existante et une nouvelle ligne est créée pour le bon
    // mois, jamais de suppression physique.
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelReason: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

// Empêche toute ligne en double pour un même membre/mois — le job de
// génération s'appuie dessus pour être idempotent, et une écriture
// concurrente (deux agents enregistrant le même membre/mois en même
// temps) échoue proprement plutôt que de dupliquer.
socialContributionSchema.index(
  { member: 1, year: 1, month: 1 },
  { unique: true }
);

socialContributionSchema.index({ church: 1, year: 1, month: 1 });

export default mongoose.model("SocialContribution", socialContributionSchema);
