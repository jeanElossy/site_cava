import mongoose from "mongoose";

// Compteur atomique du numéro de dossier "nouvelle âme", un document
// par année (voir newSoulNumber.service.js). Jamais exposé par une
// route CRUD, uniquement incrémenté via `$inc`.
const newSoulCounterSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    unique: true,
  },

  lastNumber: {
    type: Number,
    default: 0,
  },
});

export default mongoose.model("NewSoulCounter", newSoulCounterSchema);
