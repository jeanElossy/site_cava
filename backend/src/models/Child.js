import mongoose from "mongoose";

import { isTrustedChildPhotoUrl } from "../utils/cloudinaryUrl.js";
import { CHILD_FILE_PATTERN } from "../utils/childFileNumber.js";

// Enfant de l'église, suivi par l'École du dimanche.
//
// ------------------------------------------------------------------
// UN ENFANT N'EST PAS UN `Member`
// ------------------------------------------------------------------
// Ce n'est pas une nuance de vocabulaire, c'est structurel. Un membre
// reçoit un matricule attribué par le compteur de son église et une
// carte de membre ; surtout, le Service Social génère une offrande
// mensuelle DUE pour tout membre actif (voir
// socialContribution.service.js#generateDueContributions) — inscrire
// un enfant comme membre lui réclamerait une cotisation.
//
// Un enfant a donc son propre dossier, son propre numéro
// (« CAVA-ENF-000001 », voir utils/childFileNumber.js), et aucune
// carte.
//
// ------------------------------------------------------------------
// DONNÉES PERSONNELLES DE MINEURS
// ------------------------------------------------------------------
// C'est la catégorie la plus sensible de tout le projet. N'ajouter un
// champ que s'il sert à un usage précis et actuel — jamais « au cas
// où ». Les documents (acte de naissance, autorisations) vivent dans
// une collection séparée et protégée : voir ChildDocument.js.
const childSchema = new mongoose.Schema(
  {
    // Généré par childNumber.service.js, jamais saisi. Le compteur est
    // atomique : deux inscriptions simultanées ne peuvent pas obtenir
    // le même numéro.
    fileNumber: {
      type: String,
      required: [true, "Le numéro de dossier est obligatoire."],
      unique: true,
      uppercase: true,
      trim: true,
      match: [CHILD_FILE_PATTERN, "Numéro de dossier invalide."],
    },

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

    // Doit provenir d'un envoi par le formulaire d'administration, dans
    // notre dossier Cloudinary : le serveur peut avoir à récupérer
    // lui-même cette URL pour composer une fiche PDF, et une valeur
    // libre l'exposerait à une requête vers une adresse choisie par un
    // attaquant (SSRF). Même protection que `Member.photo`.
    photo: {
      type: String,
      trim: true,
      validate: {
        validator: (value) => !value || isTrustedChildPhotoUrl(value),
        message:
          "La photo doit provenir d'un envoi via l'administration, pas d'une adresse saisie librement.",
      },
    },

    // L'ÂGE N'EST PAS STOCKÉ : il se dérive (voir le virtuel `age` plus
    // bas). Un âge en base serait faux dès le lendemain de
    // l'anniversaire, et il faudrait un job pour l'entretenir.
    //
    // FACULTATIF AU NIVEAU DU SCHÉMA, exigé par le formulaire.
    //
    // Le registre papier de l'École du dimanche ne porte que des noms,
    // rangés par classe : ni date de naissance, ni sexe. Rendre ces
    // champs obligatoires ici rendrait la reprise de ce registre
    // impossible — et la seule issue serait alors d'inventer des dates,
    // ce qui est bien pire qu'un champ vide honnêtement signalé.
    //
    // Le service refuse en revanche une CRÉATION MANUELLE sans eux :
    // quelqu'un qui saisit un enfant devant lui a l'information. Voir
    // `isComplete` plus bas pour le suivi de ce qu'il reste à compléter.
    dateOfBirth: Date,

    gender: {
      type: String,
      enum: ["garcon", "fille"],
    },

    birthPlace: { type: String, trim: true, maxlength: 160 },

    // Facultatifs, présents dans les maquettes du formulaire
    // d'inscription. `homeLanguage` sert concrètement à l'équipe : une
    // classe de tout-petits qui ne parle pas la même langue que
    // l'enfant doit le savoir avant la première séance.
    nationality: { type: String, trim: true, maxlength: 80 },
    homeLanguage: { type: String, trim: true, maxlength: 80 },

    // L'adresse du foyer est le plus souvent portée par le
    // responsable (voir ChildGuardian.address) : ce champ ne sert que
    // lorsqu'elle diffère, d'où « si nécessaire » sur la maquette.
    address: { type: String, trim: true, maxlength: 300 },

    church: {
      type: Number,
      required: [true, "L'église est obligatoire."],
      min: 1,
      max: 5,
    },

    enrolledAt: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ["actif", "inactif"],
      default: "actif",
      index: true,
    },

    // ---- École du dimanche ------------------------------------

    currentClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SundaySchoolClass",
    },

    classAssignedAt: Date,

    // LE MONITEUR PRINCIPAL DE L'ENFANT N'EST PAS STOCKÉ ICI, alors
    // que la fiche l'affiche : il se déduit de sa classe (voir
    // MonitorAssignment.js). Le dénormaliser obligerait à repasser sur
    // tous les enfants d'une classe à chaque changement de moniteur —
    // et le premier oubli afficherait, sur la fiche d'un enfant, le nom
    // d'un moniteur qui ne s'occupe plus de lui.

    // ---- Responsables -----------------------------------------
    //
    // Référence + qualification du lien : le responsable lui-même vit
    // dans sa propre collection (une fratrie le partage), mais la
    // RELATION appartient au couple enfant/responsable — « mère » pour
    // l'un peut être « tante » pour l'autre.
    guardians: {
      type: [
        {
          _id: false,

          guardian: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ChildGuardian",
            required: true,
          },

          relation: {
            type: String,
            enum: [
              "pere",
              "mere",
              "tuteur",
              "grand-parent",
              "oncle",
              "tante",
              "frere",
              "soeur",
              "autre",
            ],
            required: true,
          },

          // Responsabilité légale et autorisation de récupérer sont
          // deux choses différentes, et il faut les deux : un parent
          // légal peut être empêché, une nourrice sans autorité
          // parentale peut être autorisée à venir chercher l'enfant.
          isLegalGuardian: { type: Boolean, default: false },
          canPickUp: { type: Boolean, default: true },
        },
      ],
      default: [],
      validate: {
        validator: (value) => value.length <= 8,
        message: "8 responsables maximum par enfant.",
      },
    },

    // Informations médicales et allergies : renseignées uniquement si
    // l'équipe en a besoin pour la sécurité de l'enfant pendant une
    // activité. `select: false` — jamais renvoyées par défaut.
    medicalNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      select: false,
    },

    // Notes internes de l'équipe. Même traitement que `Member.notes`.
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      select: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Recherche par nom depuis l'administration, église par église.
childSchema.index({ church: 1, lastName: 1, firstName: 1 });

// Liste d'appel : les enfants actifs d'une classe. C'est la requête la
// plus fréquente du module — un moniteur l'exécute à chaque séance.
childSchema.index({ currentClass: 1, status: 1 });

// Retrouver la fratrie d'un responsable, et la liste des enfants d'un
// parent au moment de confirmer une sortie.
childSchema.index({ "guardians.guardian": 1 });

childSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Origine du dossier. « registre » signale une fiche reprise du
// registre papier, forcément incomplète au départ : c'est ce qui
// permet à l'équipe de retrouver les dossiers à compléter, plutôt que
// de découvrir des champs vides au hasard des consultations.
childSchema.add({
  source: {
    type: String,
    enum: ["administration", "registre"],
    default: "administration",
  },
});

// Ce qui manque encore au dossier, calculé et non stocké — un champ
// « complet » en base serait faux dès la première modification.
childSchema.virtual("missingFields").get(function () {
  const missing = [];

  if (!this.dateOfBirth) missing.push("dateOfBirth");
  if (!this.gender) missing.push("gender");
  if (!this.currentClass) missing.push("currentClass");
  if (!this.guardians || this.guardians.length === 0) missing.push("guardians");

  return missing;
});

childSchema.virtual("isComplete").get(function () {
  return this.missingFields.length === 0;
});

// Âge révolu, dérivé de la date de naissance. Sert à suggérer une
// classe et à afficher la fiche — jamais à autoriser quoi que ce soit.
childSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;

  const now = new Date();
  const birth = new Date(this.dateOfBirth);

  let age = now.getUTCFullYear() - birth.getUTCFullYear();

  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();

  // L'anniversaire n'est pas encore passé cette année.
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }

  return age;
});

childSchema.set("toJSON", { virtuals: true });

// Un enfant ne peut pas être né demain, ni avoir 40 ans. La borne
// haute est volontairement large (25 ans) : elle attrape la faute de
// frappe sur l'année, pas le pré-adolescent un peu âgé.
childSchema.pre("validate", function (next) {
  if (!this.dateOfBirth) return next();

  const birth = new Date(this.dateOfBirth);

  if (birth > new Date()) {
    this.invalidate("dateOfBirth", "La date de naissance ne peut pas être dans le futur.");
  }

  const yearsAgo = (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

  if (yearsAgo > 25) {
    this.invalidate(
      "dateOfBirth",
      "Cette date correspond à un adulte. Un adulte s'enregistre comme membre, pas comme enfant."
    );
  }

  next();
});

export default mongoose.model("Child", childSchema);
