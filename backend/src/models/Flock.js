import mongoose from "mongoose";

// Bergerie à laquelle un membre appartient.
//
// Le code (2 lettres) fait partie du matricule du membre — voir
// registrationNumber.service.js. Un même code peut exister dans deux
// églises différentes, mais pas deux fois dans la même : d'où l'index
// composé plutôt qu'un index simple sur `code`.
const flockSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Le code de la bergerie est obligatoire."],
      uppercase: true,
      trim: true,
      match: [
        /^[A-Z]{2}$/,
        "Le code doit comporter exactement 2 lettres.",
      ],
    },

    name: {
      type: String,
      required: [true, "Le nom de la bergerie est obligatoire."],
      trim: true,
      maxlength: 120,
    },

    church: {
      type: Number,
      required: [true, "L'église est obligatoire."],
      min: 1,
      max: 5,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
      index: true,
    },
  },
  { timestamps: true }
);

flockSchema.index({ church: 1, code: 1 }, { unique: true });

export default mongoose.model("Flock", flockSchema);
