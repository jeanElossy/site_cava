import mongoose from "mongoose";

import { SUBSTITUTION_MODES } from "../utils/substitutionWindow.js";

// Remplacement temporaire d'un moniteur par un autre.
//
// ------------------------------------------------------------------
// CE MODÈLE NE TOUCHE JAMAIS À LA CLASSE PRINCIPALE
// ------------------------------------------------------------------
// C'est sa raison d'être. Sarah encadre les 6–8 ans ; le 30 août, elle
// remplace Jean chez les 9–11 ans. Sa classe principale reste les
// 6–8 ans — le remplacement se SUPERPOSE, il ne réaffecte pas. Écrire
// dans `MonitorAssignment` pour « déplacer » Sarah puis la « remettre »
// le lendemain reviendrait à perdre sa vraie affectation à la première
// erreur de manipulation.
//
// ------------------------------------------------------------------
// PAS DE STATUT « EXPIRÉ », ET PAS DE JOB QUI EN POSERAIT UN
// ------------------------------------------------------------------
// `status` ne porte que ce qu'un HUMAIN a décidé : `valide` ou
// `annule`. Qu'un remplacement soit à venir, en cours ou terminé se
// CALCULE à partir de la date du jour (voir
// utils/substitutionWindow.js#isSubstitutionActiveAt).
//
// Un job nocturne qui basculerait les remplacements échus laisserait
// l'accès à la seconde classe ouvert entre la fin réelle et son
// passage — exactement ce que le cahier des charges interdit
// (« après expiration, l'accès est automatiquement supprimé »). Le
// calcul, lui, est juste à la milliseconde et ne peut pas « ne pas
// avoir tourné ».
const monitorSubstitutionSchema = new mongoose.Schema(
  {
    // Le REMPLAÇANT — celui qui reçoit l'accès temporaire.
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: [true, "Le moniteur remplaçant est obligatoire."],
    },

    // Le moniteur ABSENT. Facultatif : une classe peut être orpheline
    // (moniteur parti, poste vacant) et avoir tout de même besoin
    // d'être couverte. Exiger un absent obligerait alors à en inventer
    // un.
    replacedMonitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
    },

    // La classe REMPLACÉE — jamais la classe principale du remplaçant.
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SundaySchoolClass",
      required: [true, "La classe remplacée est obligatoire."],
    },

    church: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    mode: {
      type: String,
      enum: SUBSTITUTION_MODES,
      required: [true, "Le mode de remplacement est obligatoire."],
    },

    // Mode « period » uniquement.
    startDate: Date,
    endDate: Date,

    // Modes « session » et « sessions » : les séances visées.
    sessions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ChildSession",
      },
    ],

    // Jours couverts, DÉNORMALISÉS depuis les séances ci-dessus.
    //
    // Sans eux, chaque contrôle d'accès devrait charger les séances
    // référencées — or ce contrôle est fait à CHAQUE requête d'un
    // moniteur, pas une fois par jour. Le service les recalcule quand
    // les séances changent (voir substitution.service.js) ; ils ne sont
    // jamais saisis.
    sessionDates: {
      type: [Date],
      default: [],
    },

    reason: { type: String, trim: true, maxlength: 300 },

    // DEUX valeurs, et pas une de plus. Voir l'en-tête du fichier.
    status: {
      type: String,
      enum: ["valide", "annule"],
      default: "valide",
      index: true,
    },

    cancelledAt: Date,
    cancelReason: { type: String, trim: true, maxlength: 300 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Contrôle d'accès : « quels remplacements valides ce moniteur a-t-il ? »
// La requête la plus chaude du module — exécutée à chaque appel de
// l'espace moniteur.
monitorSubstitutionSchema.index({ monitor: 1, status: 1 });

// Écrans d'administration : par classe, par date.
monitorSubstitutionSchema.index({ class: 1, startDate: 1 });
monitorSubstitutionSchema.index({ church: 1, status: 1 });

// Cohérence du mode. Aucune de ces règles n'est exprimable par un index
// MongoDB : ce sont des contraintes ENTRE champs, elles ne peuvent
// vivre qu'ici (ou dans le service, où on les oublierait un jour).
monitorSubstitutionSchema.pre("validate", function (next) {
  if (this.mode === "period") {
    if (!this.startDate || !this.endDate) {
      this.invalidate(
        "startDate",
        "Un remplacement sur une période exige une date de début et une date de fin."
      );
    } else if (this.startDate > this.endDate) {
      this.invalidate(
        "endDate",
        "La date de fin doit être postérieure à la date de début."
      );
    }
  } else if (this.sessionDates.length === 0) {
    // Un remplacement sans aucun jour ne couvrirait RIEN — et c'est
    // bien ainsi que `isSubstitutionActiveAt` le traite. Autant le
    // refuser à l'écriture plutôt que de créer un document qui donne
    // l'illusion d'un accès sans jamais en ouvrir un.
    this.invalidate(
      "sessions",
      "Sélectionnez au moins une séance à remplacer."
    );
  }

  // Se remplacer soi-même n'a pas de sens et masquerait une erreur de
  // saisie derrière un document parfaitement valide.
  if (
    this.replacedMonitor &&
    String(this.replacedMonitor) === String(this.monitor)
  ) {
    this.invalidate(
      "replacedMonitor",
      "Un moniteur ne peut pas se remplacer lui-même."
    );
  }

  next();
});

export default mongoose.model("MonitorSubstitution", monitorSubstitutionSchema);
