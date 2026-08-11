import mongoose from "mongoose";

// Aide sociale (décaissement de la caisse du Service Social) — Phase
// 2. Voir
// docs/superpowers/specs/2026-08-11-service-social-phase2-design.md.
//
// ------------------------------------------------------------------
// WORKFLOW À 2 ÉTAPES
// ------------------------------------------------------------------
// en_attente -> payee (validation = décaissement immédiat, pas d'étape
//               séparée entre "validée" et "payée")
// en_attente -> refusee (motif obligatoire)
// payee      -> annulee (réservé admin, ne supprime rien — voir
//               socialAid.service.js#cancelAid et SocialLedgerEntry)
//
// `reference` n'est assignée qu'à la décision (comme
// SocialContribution.reference en Phase 1) : une aide en_attente n'a
// pas encore de trace comptable.
const socialAidSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: [true, "Le bénéficiaire est obligatoire."],
    },

    // Dénormalisé depuis member.church au moment de la création — sert
    // aux filtres et au calcul du solde de caisse de l'église
    // concernée, sans avoir à repopuler le membre à chaque lecture.
    church: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    // `ref` pointe vers la collection administrable ; `name` est une
    // copie figée au moment de la demande — même pattern que
    // Donation.donationType : si le type est renommé ou désactivé plus
    // tard, l'historique reste lisible tel qu'il était.
    aidType: {
      ref: { type: mongoose.Schema.Types.ObjectId, ref: "SocialAidType" },
      name: {
        type: String,
        required: [true, "Le type d'aide est obligatoire."],
        trim: true,
        maxlength: 60,
      },
    },

    amount: {
      type: Number,
      required: [true, "Le montant est obligatoire."],
      min: 0,
    },

    motif: {
      type: String,
      required: [true, "Le motif est obligatoire."],
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    // URL Cloudinary de la pièce justificative. Aucune validation de
    // domaine ici contrairement à Member.photo : jamais re-fetchée par
    // le serveur (pas de risque SSRF), seulement affichée en lien dans
    // l'administration.
    proofUrl: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["en_attente", "payee", "refusee", "annulee"],
      default: "en_attente",
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    decidedAt: Date,

    // Obligatoire si status === "refusee" — validé dans le service,
    // pas au niveau du schéma (même approche que SocialContribution
    // pour la cotisation exonérée : le motif d'exonération n'est pas
    // marqué required au niveau schéma non plus).
    decisionNote: {
      type: String,
      trim: true,
      maxlength: 400,
    },

    // Posé en même temps que decidedAt si status devient "payee".
    paidAt: Date,

    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelReason: {
      type: String,
      trim: true,
      maxlength: 400,
    },
  },
  { timestamps: true }
);

// Listes filtrées par église/statut (administration).
socialAidSchema.index({ church: 1, status: 1 });
// Tri par défaut (plus récentes d'abord).
socialAidSchema.index({ createdAt: -1 });

export default mongoose.model("SocialAid", socialAidSchema);
