import mongoose from "mongoose";

// Compteur atomique de matricules, un document par église.
//
// Jamais exposé par une route CRUD : seule la génération de matricule
// (voir registrationNumber.service.js) l'incrémente, via `$inc`, pour
// que deux validations simultanées ne produisent jamais le même
// numéro.
const registrationCounterSchema = new mongoose.Schema({
  church: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 5,
  },

  lastNumber: {
    type: Number,
    default: 0,
  },
});

export default mongoose.model(
  "RegistrationCounter",
  registrationCounterSchema
);
