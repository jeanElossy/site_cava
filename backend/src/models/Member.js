import mongoose from "mongoose";

const baptismSchema = new mongoose.Schema(
  {
    water: { type: Boolean, default: false },
    waterYear: { type: Number, min: 1900, max: 2100 },
    holySpirit: { type: Boolean, default: false },
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false }
);

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

    // Matricule et rattachement — voir registrationNumber.service.js
    // pour le format et la génération.
    registrationNumber: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
      match: [
        /^[1-5][A-Z]{2}\d{2}\d{3}[A-Z]$/,
        "Matricule invalide.",
      ],
    },

    church: { type: Number, min: 1, max: 5 },

    flock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flock",
    },

    // État civil
    dateOfBirth: Date,
    gender: { type: String, enum: ["homme", "femme"] },
    maritalStatus: {
      type: String,
      enum: ["celibataire", "marie", "veuf", "divorce"],
    },
    childrenCount: { type: Number, min: 0, max: 30 },

    // Vie spirituelle
    conversionYear: { type: Number, min: 1900, max: 2100 },
    baptism: { type: baptismSchema, default: () => ({}) },
    previousChurch: { type: String, trim: true, maxlength: 160 },

    // Engagement et service
    profession: { type: String, trim: true, maxlength: 120 },
    skills: {
      type: [String],
      validate: {
        validator: (v) => v.length <= 20,
        message: "20 compétences maximum.",
      },
      default: [],
    },
    desiredDepartment: { type: String, trim: true, maxlength: 120 },
    availability: { type: String, trim: true, maxlength: 300 },

    // Contact étendu — le quartier reste porté par le champ `area`
    // existant, pas de doublon ici.
    whatsapp: { type: String, trim: true, maxlength: 40 },
    address: { type: String, trim: true, maxlength: 300 },
    emergencyContact: {
      type: emergencyContactSchema,
      default: () => ({}),
    },
    photo: { type: String, trim: true },

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
memberSchema.index({ church: 1, flock: 1 });

memberSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

memberSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Member", memberSchema);
