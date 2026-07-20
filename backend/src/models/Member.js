import mongoose from "mongoose";

// Membres de la communauté.
//
// DONNÉES PERSONNELLES : un membre est une personne identifiable.
// N'ajouter un champ que s'il sert réellement à un usage précis —
// pas « au cas où ». C'est autant une exigence légale qu'une bonne
// pratique de modélisation.
//
// Ce modèle ne porte volontairement PAS de mot de passe : les membres
// n'ont pas de compte à ce stade, ils sont enregistrés par
// l'administration. Le jour où un espace membre existera, l'ajout
// d'une authentification devra reprendre les protections du modèle
// `User` (hachage, `select: false`). 
const memberSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "Le prénom est obligatoire."],
      trim: true,
      maxlength: 80,
    },

    lastName: {
      type: String,
      required: [true, "Le nom est obligatoire."],
      trim: true,
      maxlength: 80,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Adresse e-mail invalide.",
      ],
      // Unicité seulement si renseigné : un membre peut n'avoir que
      // son téléphone, cas courant à Abidjan.
      sparse: true,
      unique: true,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 40,
    },

    // Quartier / commune, utile pour rattacher à un groupe de maison.
    area: { type: String, trim: true, maxlength: 120 },

    // Référence : un ministère existe indépendamment du membre.
    ministries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ministry",
      },
    ],

    role: {
      type: String,
      enum: ["membre", "serviteur", "responsable"],
      default: "membre",
    },

    joinedAt: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ["actif", "inactif"],
      default: "actif",
      index: true,
    },

    // Notes internes de l'équipe pastorale. Jamais exposées
    // publiquement : à exclure explicitement de toute route publique.
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      select: false,
    },
  },
  { timestamps: true }
);

// Recherche par nom depuis l'administration.
memberSchema.index({ lastName: 1, firstName: 1 });

memberSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

memberSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Member", memberSchema);
