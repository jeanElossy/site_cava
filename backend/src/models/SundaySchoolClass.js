import mongoose from "mongoose";

// Classe de l'École du dimanche.
//
// ENTIÈREMENT CONFIGURABLE : rien n'est codé en dur, ni le nombre de
// classes, ni leurs noms, ni leurs tranches d'âge. « Petits »,
// « 6–8 ans », « Pré-ados » sont des exemples d'usage, pas une
// structure imposée — une assemblée qui découpe autrement doit pouvoir
// le faire depuis l'administration, sans développeur.
const sundaySchoolClassSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom de la classe est obligatoire."],
      trim: true,
      maxlength: 80,
    },

    description: { type: String, trim: true, maxlength: 400 },

    // Tranche d'âge INDICATIVE.
    //
    // Elle sert à suggérer une classe au moment d'inscrire un enfant,
    // jamais à refuser une affectation : un enfant en avance, en
    // retard, ou qu'on garde avec sa fratrie doit rester possible. Une
    // règle bloquante serait contournée dès le premier cas réel, et le
    // contournement serait plus coûteux que l'absence de règle.
    ageMin: { type: Number, min: 0, max: 25 },
    ageMax: { type: Number, min: 0, max: 25 },

    room: { type: String, trim: true, maxlength: 120 },

    // Horaire habituel, tel qu'affiché sur la fiche d'un enfant
    // (« Dimanche, 09:00 – 11:00 »). C'est une INDICATION servant à
    // pré-remplir une nouvelle séance : la séance, elle, porte sa
    // propre date et ses propres horaires, qui font foi (voir
    // ChildSession.js). Une classe qui change d'horaire ne réécrit donc
    // jamais l'historique de ses séances passées.
    usualDay: {
      type: String,
      enum: [
        "lundi",
        "mardi",
        "mercredi",
        "jeudi",
        "vendredi",
        "samedi",
        "dimanche",
      ],
      default: "dimanche",
    },

    // « 09:00 » — affichage, comme `Event.time`.
    usualStartTime: { type: String, trim: true, maxlength: 10 },
    usualEndTime: { type: String, trim: true, maxlength: 10 },

    // Pastille illustrant la classe dans les listes. Un émoji, pas une
    // image : aucun fichier à héberger, aucun chemin à casser, et le
    // rendu est identique sur tous les appareils de l'équipe.
    icon: { type: String, trim: true, maxlength: 8 },

    // Même découpage que le reste du projet : une église est un numéro
    // de 1 à 5 (voir Church.js et le format du matricule).
    church: {
      type: Number,
      required: [true, "L'église est obligatoire."],
      min: 1,
      max: 5,
    },

    // Responsable de la classe — un MEMBRE adulte, jamais un compte.
    // Distinct des moniteurs affectés (voir MonitorAssignment.js) :
    // c'est un rôle d'organisation, qui n'ouvre aucun accès par
    // lui-même.
    leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
    },

    // « archived » plutôt qu'une suppression : une classe désactivée
    // garde son historique de séances et de présences, qui n'aurait
    // plus de sens rattaché à rien.
    status: {
      type: String,
      enum: ["published", "archived"],
      default: "published",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Deux classes du même nom dans la même église seraient
// indiscernables à l'écran comme dans les listes d'appel. Le même nom
// dans deux églises différentes reste permis — chacune organise son
// École du dimanche comme elle l'entend.
sundaySchoolClassSchema.index({ church: 1, name: 1 }, { unique: true });

sundaySchoolClassSchema.index({ church: 1, status: 1 });

sundaySchoolClassSchema.pre("validate", function (next) {
  if (
    typeof this.ageMin === "number" &&
    typeof this.ageMax === "number" &&
    this.ageMin > this.ageMax
  ) {
    this.invalidate(
      "ageMax",
      "L'âge maximum doit être supérieur ou égal à l'âge minimum."
    );
  }

  next();
});

export default mongoose.model("SundaySchoolClass", sundaySchoolClassSchema);
