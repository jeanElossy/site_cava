import mongoose from "mongoose";

// Compteur atomique de la référence des cotisations sociales
// (« SOC-YYYYMMDD-NNNNNN » — voir socialContribution.service.js).
//
// Un SEUL document pour tout le système, contrairement à
// `RegistrationCounter` qui est par église : la référence sociale n'a
// pas besoin d'être lisible par église, seulement unique. Identifié
// par une clé fixe plutôt que par le `_id` Mongo par défaut, pour que
// `findOneAndUpdate({ key: "social" }, ...)` cible toujours le même
// document sans avoir à le connaître à l'avance (upsert au premier
// paiement).
const socialCounterSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: "social",
  },

  seq: {
    type: Number,
    default: 0,
  },
});

export default mongoose.model("SocialCounter", socialCounterSchema);
