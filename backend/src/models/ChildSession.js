import mongoose from "mongoose";

export const CHILD_SESSION_TYPES = [
  "ecole_du_dimanche",
  "culte",
  "activite",
  "sortie",
  "camp",
  "evenement_special",
];

// Séance d'une classe : l'occasion à laquelle on fait l'appel.
//
// ------------------------------------------------------------------
// LA SÉANCE PORTE SA PROPRE DATE ET SES PROPRES HORAIRES
// ------------------------------------------------------------------
// La classe porte un horaire HABITUEL (voir SundaySchoolClass.js), qui
// sert seulement à pré-remplir. Une classe qui change d'horaire ne doit
// pas réécrire l'histoire de ses séances passées : c'est pourquoi les
// horaires sont recopiés ici à la création, et non lus depuis la classe
// à l'affichage.
//
// ------------------------------------------------------------------
// LE JOUR EST NORMALISÉ, ET C'EST CE QUI REND L'APPEL IDEMPOTENT
// ------------------------------------------------------------------
// `date` est ramenée à minuit UTC (voir le hook plus bas). Deux
// moniteurs qui ouvrent l'appel de la même classe le même dimanche à
// dix minutes d'intervalle tombent ainsi sur LA MÊME séance, garanti
// par l'index unique `{class, date}` — pas sur deux séances
// concurrentes portant chacune la moitié des présences.
//
// Abidjan est à UTC+0 toute l'année : le jour UTC est exactement le
// jour civil vécu sur place (voir utils/substitutionWindow.js).
const childSessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      maxlength: 160,
    },

    type: {
      type: String,
      enum: CHILD_SESSION_TYPES,
      default: "ecole_du_dimanche",
      required: true,
    },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SundaySchoolClass",
      required: [true, "La classe est obligatoire."],
    },

    church: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    date: {
      type: Date,
      required: [true, "La date est obligatoire."],
    },

    // Affichage, comme `Event.time` : « 09:00 ».
    startTime: { type: String, trim: true, maxlength: 10 },
    endTime: { type: String, trim: true, maxlength: 10 },

    room: { type: String, trim: true, maxlength: 120 },

    // Thème ou activité de la séance (« Parabole du semeur »).
    theme: { type: String, trim: true, maxlength: 240 },

    // Événement de l'église auquel cette séance se rattache, le cas
    // échéant. RÉFÉRENCE vers le modèle `Event` EXISTANT : le module
    // ne crée pas un second système d'événements, il s'y accroche.
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },

    // Moniteur NORMALEMENT responsable — celui de la classe, pas
    // forcément celui qui fera l'appel. L'écart entre les deux est
    // précisément ce que l'audit d'un remplacement doit montrer (voir
    // ChildAttendance.js).
    responsibleMonitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
    },

    status: {
      type: String,
      enum: ["planifiee", "terminee", "annulee"],
      default: "planifiee",
      index: true,
    },

    notes: { type: String, trim: true, maxlength: 1000 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// UNE séance par classe et par jour. C'est ce qui rend l'ouverture de
// l'appel idempotente — voir l'en-tête.
childSessionSchema.index({ class: 1, date: 1 }, { unique: true });

// Planning : les séances d'une église, par date.
childSessionSchema.index({ church: 1, date: -1 });

// Normalisation du jour, sur les DEUX chemins d'écriture (`save()` et
// `findOneAndUpdate()`) : la poser dans le service laisserait passer
// les scripts, qui écrivent en direct — même raisonnement que
// `applyRegistrationOrder` dans Member.js.
const normalizeDay = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
};

childSessionSchema.pre("save", function (next) {
  if (this.date) this.date = normalizeDay(this.date);

  next();
});

childSessionSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();

  if (!update) return next();

  const target = update.$set ?? update;

  if (Object.prototype.hasOwnProperty.call(target, "date")) {
    target.date = normalizeDay(target.date);

    this.setUpdate(update);
  }

  next();
});

export default mongoose.model("ChildSession", childSessionSchema);
