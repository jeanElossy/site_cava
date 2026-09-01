import mongoose from "mongoose";

// Remise de l'enfant à la personne venue le chercher, en fin de séance.
//
// ------------------------------------------------------------------
// FONCTIONNALITÉ OPTIONNELLE, PAR ACTIVITÉ
// ------------------------------------------------------------------
// Le pointage des sorties a du sens pour une sortie ou un camp ; il
// serait une corvée inutile à chaque école du dimanche ordinaire. Il
// s'active donc séance par séance (`ChildSession` reste maître du
// choix, via le service), et l'absence d'enregistrement ne signifie
// jamais qu'un enfant n'a pas été récupéré — seulement qu'on ne l'a pas
// noté.
//
// ------------------------------------------------------------------
// L'AUTORISATION EST VÉRIFIÉE, PAS SEULEMENT AFFICHÉE
// ------------------------------------------------------------------
// `Child.guardians[].canPickUp` dit qui a le droit de venir chercher
// l'enfant. Le service refuse d'enregistrer une sortie au profit d'un
// responsable non autorisé, plutôt que de se contenter d'afficher un
// avertissement qu'on finirait par ignorer.
//
// `pickedUpByOther` couvre le cas réel qui, sinon, ferait contourner la
// règle : quelqu'un que personne n'a prévu se présente. On l'enregistre
// alors explicitement, avec son nom et le moniteur qui a tranché — une
// exception tracée vaut mieux qu'une règle contournée en silence.
const childCheckoutSchema = new mongoose.Schema(
  {
    child: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: true,
    },

    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChildSession",
      required: true,
    },

    checkedInAt: Date,

    checkedOutAt: Date,

    // Le responsable déclaré, quand c'est l'un de ceux du dossier.
    pickedUpBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChildGuardian",
    },

    // Sinon, l'identité relevée à la main. Voir l'en-tête : c'est
    // l'exception tracée, pas un contournement.
    pickedUpByOther: {
      name: { type: String, trim: true, maxlength: 160 },
      relation: { type: String, trim: true, maxlength: 80 },
      phone: { type: String, trim: true, maxlength: 40 },
    },

    // Le moniteur qui a confirmé la remise.
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    note: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

// Une seule remise par enfant et par séance.
childCheckoutSchema.index({ child: 1, session: 1 }, { unique: true });

childCheckoutSchema.index({ session: 1 });

// Une remise doit dire QUI est venu, d'une façon ou d'une autre.
childCheckoutSchema.pre("validate", function (next) {
  if (this.checkedOutAt && !this.pickedUpBy && !this.pickedUpByOther?.name) {
    this.invalidate(
      "pickedUpBy",
      "Indiquez qui est venu chercher l'enfant."
    );
  }

  next();
});

export default mongoose.model("ChildCheckout", childCheckoutSchema);
