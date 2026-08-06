import crypto from "node:crypto";

import mongoose from "mongoose";

// Don déclaré par un fidèle, réglé en dehors du site (Mobile Money),
// et vérifié manuellement par un administrateur.
//
// ------------------------------------------------------------------
// AUCUNE CONFIRMATION AUTOMATIQUE
// ------------------------------------------------------------------
// Contrairement à l'ancien modèle (CinetPay), rien ici ne prouve
// qu'un paiement a réellement eu lieu : le donateur déclare un
// montant et un numéro de transaction, l'admin vérifie contre le
// relevé Mobile Money réel de l'église avant de valider. C'est un
// compromis assumé — voir la spec pour la discussion des risques de
// fraude et pourquoi le numéro de transaction est obligatoire alors
// que la capture d'écran ne l'est pas (une capture peut être une
// ancienne capture réutilisée).
const donationSchema = new mongoose.Schema(
  {
    // Référence publique, non devinable — sert de clé pour le reçu
    // (voir receipt.service.js) une fois le don validé.
    reference: {
      type: String,
      unique: true,
      index: true,
      default: () =>
        `CAVA-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
    },

    donor: {
      firstName: {
        type: String,
        required: [true, "Le prénom est obligatoire."],
        trim: true,
        maxlength: 60,
      },
      lastName: {
        type: String,
        required: [true, "Le nom est obligatoire."],
        trim: true,
        maxlength: 60,
      },
      phone: {
        type: String,
        required: [true, "Le téléphone est obligatoire."],
        trim: true,
        maxlength: 30,
      },
      email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    },

    amount: {
      type: Number,
      required: [true, "Le montant est obligatoire."],
      min: [200, "Le montant minimum est de 200 F CFA."],
      max: [10000000, "Le montant maximum est de 10 000 000 F CFA."],
    },

    currency: {
      type: String,
      enum: ["XOF"],
      default: "XOF",
    },

    // `ref` pointe vers la collection administrable ; `name` est une
    // copie figée au moment du don — si un type/moyen est renommé ou
    // désactivé plus tard, l'historique reste lisible tel qu'il était.
    donationType: {
      ref: { type: mongoose.Schema.Types.ObjectId, ref: "DonationType" },
      name: {
        type: String,
        required: [true, "Le type de don est obligatoire."],
        trim: true,
        maxlength: 60,
      },
    },

    paymentMethod: {
      ref: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMethod" },
      name: {
        type: String,
        required: [true, "Le moyen de paiement est obligatoire."],
        trim: true,
        maxlength: 60,
      },
    },

    proof: {
      transactionId: {
        type: String,
        required: [
          true,
          "Le numéro de transaction Mobile Money est obligatoire.",
        ],
        trim: true,
        maxlength: 60,
      },
      imageUrl: { type: String, trim: true, default: "" },
      submittedAt: { type: Date, default: Date.now },
    },

    status: {
      type: String,
      enum: ["en_attente", "valide", "rejete"],
      default: "en_attente",
      index: true,
    },

    adminNote: { type: String, trim: true, maxlength: 400, default: "" },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,

    ip: { type: String, trim: true, maxlength: 60 },
  },
  { timestamps: true }
);

// Les deux lectures faites par l'administration : la liste récente,
// et le filtre par statut.
donationSchema.index({ status: 1, createdAt: -1 });
donationSchema.index({ createdAt: -1 });

export default mongoose.model("Donation", donationSchema);
