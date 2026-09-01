import mongoose from "mongoose";

// Compteur atomique du numéro de dossier des enfants
// (« CAVA-ENF-000001 » — voir utils/childFileNumber.js).
//
// Un SEUL document pour tout le réseau, comme `SocialCounter` et
// contrairement à `RegistrationCounter` qui est par église : le
// matricule d'un membre encode son église et son rang dans celle-ci,
// alors qu'un numéro de dossier enfant n'a besoin que d'être unique.
//
// Identifié par une clé fixe plutôt que par le `_id` Mongo, pour que
// `findOneAndUpdate({ key: "child" }, ...)` cible toujours le même
// document sans avoir à le connaître à l'avance (upsert au premier
// enfant enregistré).
//
// Jamais exposé par une route CRUD : seul childNumber.service.js
// l'incrémente, via `$inc`, pour que deux inscriptions simultanées ne
// puissent pas obtenir le même numéro.
const childCounterSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: "child",
  },

  seq: {
    type: Number,
    default: 0,
  },
});

export default mongoose.model("ChildCounter", childCounterSchema);
