import mongoose from "mongoose";

// Soumission publique d'inscription ou de mise à jour, en attente de
// revue par un administrateur.
//
// N'écrit jamais directement `Member` : c'est le service d'approbation
// (submission.service.js) qui, seul, transforme une soumission validée
// en fiche membre. `data` porte une copie brute des champs du
// formulaire — la validation stricte a lieu au moment de la création
// du `Member`, quand l'administrateur valide, pas ici.
const memberSubmissionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["new", "update"],
      required: true,
    },

    // Rempli seulement pour `type: "update"`, sous forme normalisée
    // (voir normalizeRegistrationNumber), tel que saisi par le membre.
    submittedRegistrationNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    // Résolu côté serveur si `submittedRegistrationNumber` correspond
    // à un membre déjà informatisé. Jamais renvoyé au formulaire
    // public : utilisé uniquement par l'écran de comparaison de
    // l'administration.
    existingMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    rejectionReason: { type: String, trim: true, maxlength: 500 },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    processedAt: Date,
  },
  { timestamps: true }
);

memberSubmissionSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model(
  "MemberSubmission",
  memberSubmissionSchema
);
