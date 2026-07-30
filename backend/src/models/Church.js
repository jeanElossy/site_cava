import mongoose from "mongoose";

// Église du réseau CAVA.
//
// Le numéro (1 à 5) est structurel : il fait partie du format du
// matricule des membres (voir registrationNumber.service.js) et ne
// doit jamais être réutilisé pour une autre église une fois attribué.
// Seul le NOM affiché est destiné à être modifié depuis
// l'administration, pour ne pas dépendre d'un développeur à chaque
// renommage ou ouverture d'une nouvelle église.
const churchSchema = new mongoose.Schema(
  {
    number: {
      type: Number,
      required: [true, "Le numéro de l'église est obligatoire."],
      min: 1,
      max: 5,
      unique: true,
    },

    name: {
      type: String,
      required: [true, "Le nom de l'église est obligatoire."],
      trim: true,
      maxlength: 160,
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

export default mongoose.model("Church", churchSchema);
