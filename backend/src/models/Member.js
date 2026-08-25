import mongoose from "mongoose";

import { isTrustedMemberPhotoUrl } from "../utils/cloudinaryUrl.js";
import {
  hasValidControlLetter,
  letterForNumber,
  parseRegistrationNumber,
  registrationOrderOf,
  UNRANKED,
} from "../utils/registrationFormat.js";

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
    relation: { type: String, trim: true, maxlength: 60 },
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
      enum: [
        "membre",
        "serviteur",
        "responsable",
        "pasteur",
        "chantre",
        "dirigeant",
        "instrumentaliste",
        "evangeliste",
        "intercesseur",
        "intercesseurse",
        "organisateur",
        "organisatrice",
        "monitrice",
        "responsable de bergerie",
        "dirigeante",
        "responsable chantre",
        "communication",
        "responsable communication",
      ],
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
      // La lettre finale n'est PAS libre : elle se déduit du numéro
      // (voir utils/registrationFormat.js). Un matricule saisi à la
      // main dont la lettre ne correspond pas au numéro passait
      // jusqu'ici sans le moindre avertissement — c'est ce qui a mis
      // deux membres du registre hors séquence de lettres alors que
      // leurs numéros, eux, s'enchaînaient correctement.
      //
      // On REFUSE plutôt que de corriger en silence : une lettre
      // fausse peut tout aussi bien signaler une faute de frappe dans
      // le NUMÉRO, et c'est à un humain de trancher lequel des deux
      // est le bon.
      validate: {
        validator: (value) => !value || hasValidControlLetter(value),
        message: (props) => {
          const parsed = parseRegistrationNumber(props.value);

          if (!parsed) return "Matricule invalide.";

          const expected = letterForNumber(parsed.number);
          const number = String(parsed.number).padStart(3, "0");

          return (
            `Lettre de contrôle incohérente : le numéro ${number} correspond ` +
            `à la lettre « ${expected} », pas « ${parsed.letter} ». ` +
            `Le matricule attendu est donc ${props.value.slice(0, 8)}${expected} — ` +
            "vérifiez le numéro autant que la lettre."
          );
        },
      },
    },

    // Rang d'inscription dans l'église, extrait du matricule
    // (« 1OL25045S » → 45). DÉRIVÉ, jamais saisi : les hooks plus bas
    // le recalculent à chaque écriture du matricule.
    //
    // Dénormalisé pour que l'API puisse TRIER par ordre réel
    // d'inscription. Trier sur `registrationNumber` lui-même classerait
    // d'abord par code de bergerie (positions 2-3) et mélangerait les
    // rangs ; et retrier dans le navigateur ne réordonnait que la page
    // affichée — d'où des matricules qui semblaient sauter dans
    // l'annuaire dès que l'église a dépassé une page de membres.
    //
    // `UNRANKED` (1000, au-dessus du plafond de 999 du format) pour un
    // membre sans matricule : il se range ainsi à la fin de son église
    // au lieu de remonter en tête comme le ferait un champ absent.
    registrationOrder: {
      type: Number,
      default: UNRANKED,
      min: 1,
      max: UNRANKED,
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
    // Doit être une URL Cloudinary de NOTRE compte, dans le dossier
    // membres (voir utils/cloudinaryUrl.js) : le serveur va lui-même
    // récupérer cette URL pour générer la carte de membre
    // (memberCardSvg.service.js) — une valeur libre exposerait le
    // serveur à une requête vers une adresse choisie par un
    // attaquant (SSRF), quel que soit le chemin qui a écrit le champ.
    photo: {
      type: String,
      trim: true,
      validate: {
        validator: (value) => !value || isTrustedMemberPhotoUrl(value),
        message:
          "La photo doit provenir d'un envoi via le formulaire ou l'administration, pas d'une adresse saisie librement.",
      },
    },

    // Notes internes de l'équipe pastorale. Jamais exposées
    // publiquement : à exclure explicitement de toute route publique.
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      select: false,
    },

    // Verrou anti-énumération du pré-remplissage public par matricule
    // — voir submission.service.js#lookup. Jamais exposés par une
    // route publique ; purement internes au mécanisme de protection.
    lookupFailedAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lookupLockedUntil: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

// Le rang d'inscription est DÉRIVÉ du matricule : il se recalcule à
// chaque écriture, sur les deux chemins possibles (`save()` pour une
// création, `findOneAndUpdate()` pour le CRUD d'administration et la
// validation d'inscription). Le poser dans le service appelant aurait
// laissé passer les scripts d'amorçage, qui écrivent en direct.
const applyRegistrationOrder = function (next) {
  if (this.isNew || this.isModified("registrationNumber")) {
    this.registrationOrder = registrationOrderOf(this.registrationNumber);
  }

  next();
};

memberSchema.pre("save", applyRegistrationOrder);

memberSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();

  if (!update) return next();

  // Mongoose accepte les deux formes : `{ champ: valeur }` (utilisée
  // par crud.service.js et submission.service.js) et `{ $set: {...} }`.
  const target = update.$set ?? update;

  if (Object.prototype.hasOwnProperty.call(target, "registrationNumber")) {
    target.registrationOrder = registrationOrderOf(target.registrationNumber);

    this.setUpdate(update);
  }

  next();
});

// Recherche par nom depuis l'administration.
memberSchema.index({ lastName: 1, firstName: 1 });
memberSchema.index({ church: 1, flock: 1 });

// Ordre d'affichage de l'annuaire : ordre réel d'inscription, église
// par église (voir `registrationOrder` ci-dessus).
memberSchema.index({ church: 1, registrationOrder: 1 });

memberSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

memberSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Member", memberSchema);
