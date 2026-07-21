import mongoose from "mongoose";

// Témoignages de membres, affichés sur la page Don et la page Communauté.
//
// ------------------------------------------------------------------
// POURQUOI CE MODÈLE EXISTE
// ------------------------------------------------------------------
// Les témoignages étaient écrits en dur dans les composants, et ceux
// qui s'y trouvaient étaient inventés : des paroles attribuées
// nommément à des membres qui ne les avaient jamais prononcées. Un
// visiteur cherchant à retrouver la personne avant de donner découvrait
// que personne ne la connaissait.
//
// Les faire vivre en base ne règle pas ce problème à lui seul : rien
// n'empêche d'y saisir une invention. Ce que ça change, c'est que le
// contenu devient modifiable par ceux qui ont RECUEILLI les
// témoignages, sans passer par le code — et que le consentement est
// enregistré avec.

const testimonialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom du témoin est obligatoire."],
      trim: true,
      maxlength: 80,
    },

    // « Membre depuis 2022 », « Responsable d'accueil »… Situe la
    // personne dans l'église et rend le témoignage vérifiable.
    role: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    quote: {
      type: String,
      required: [true, "Le témoignage est obligatoire."],
      trim: true,
      maxlength: 1200,
    },

    // Où le témoignage apparaît.
    //
    // Les deux pages n'attendent pas le même propos : celle du don
    // parle de l'usage des contributions, celle de la communauté de la
    // vie d'église. Un même texte aux deux endroits sonnerait faux.
    placement: {
      type: String,
      enum: ["don", "communaute"],
      required: true,
      index: true,
    },

    // ------------------------------------------------------------
    // CONSENTEMENT
    // ------------------------------------------------------------
    // Obligatoire, et c'est délibéré : publier sous le nom de quelqu'un
    // un propos sur sa vie personnelle — une perte d'emploi, une
    // épreuve familiale — sans son accord explicite lui porte
    // préjudice, quelle que soit la bonne intention.
    //
    // Le champ ne prouve rien à lui seul. Il oblige en revanche celui
    // qui saisit à répondre à la question, et laisse une trace datée si
    // la personne demande un jour le retrait.
    consent: {
      type: Boolean,
      required: [
        true,
        "L'accord de la personne est obligatoire avant publication.",
      ],
      validate: {
        validator: (value) => value === true,
        message:
          "Un témoignage ne peut être publié sans l'accord de la personne citée.",
      },
    },

    consentAt: { type: Date, default: Date.now },

    // Qui a recueilli le témoignage, pour savoir vers qui se tourner en
    // cas de question.
    collectedBy: { type: String, trim: true, maxlength: 80, default: "" },

    // Ordre d'affichage. Les plus petits d'abord, puis les plus récents.
    order: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
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

// La lecture publique : par emplacement, triée.
testimonialSchema.index({ placement: 1, status: 1, order: 1, createdAt: -1 });

export default mongoose.model("Testimonial", testimonialSchema);
