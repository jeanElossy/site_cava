import mongoose from "mongoose";

// Postes ouverts de l'appel à candidatures.
//
// Pourquoi une collection À PART des ministères, avec lesquels on
// pourrait être tenté de les confondre :
//
//   - « Finance & Administration » et « Secrétariat exécutif » ne sont
//     pas des ministères ; les y ranger les aurait fait apparaître sur
//     /ministries et dans la grille publique des ministères ;
//   - un ministère est une activité PERMANENTE de l'Église, un poste
//     ouvert est une CAMPAGNE de recrutement : il s'ouvre, se pourvoit
//     et se ferme, sans que le ministère correspondant disparaisse ;
//   - les deux n'ont pas les mêmes champs (missions, profil recherché,
//     engagement attendu n'ont aucun sens sur un ministère).
//
// Les listes (missions, profil) sont EMBARQUÉES : elles n'existent pas
// hors de leur poste, sont toujours lues avec lui et restent courtes.

// Une ligne de liste à puces (mission, critère de profil).
const lineSchema = new mongoose.Schema(
  {
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
  },
  { _id: false }
);

const positionSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Le slug ne peut contenir que des minuscules, des chiffres et des tirets.",
      ],
    },

    title: {
      type: String,
      required: [true, "L'intitulé du poste est obligatoire."],
      trim: true,
      maxlength: 120,
    },

    // Ligne sous le titre sur la carte : « Futurs formateurs »,
    // « Équipe à constituer »…
    subtitle: {
      type: String,
      trim: true,
      maxlength: 120,
    },

    // Habillage de la carte. Énumérations FERMÉES : une valeur libre
    // ne produirait aucune erreur, la carte resterait simplement sans
    // fond et son icône blanche deviendrait invisible — exactement le
    // piège déjà rencontré sur les cartes de ministères.
    variant: {
      type: String,
      enum: ["light", "gold", "dark"],
      default: "light",
    },

    icon: {
      type: String,
      enum: [
        "graduation",
        "prayer",
        "flock",
        "worship",
        "finance",
        "secretariat",
        "media",
        "social",
      ],
      default: "worship",
    },

    // Paragraphe d'introduction de la page de détail.
    intro: {
      type: String,
      trim: true,
      maxlength: 1200,
    },

    // Bornées : au-delà, ce n'est plus une fiche de poste mais un
    // document, qui a sa place ailleurs.
    //
    // Tableaux d'OBJETS `{ value }` et non de chaînes : c'est la forme
    // que produit le champ répétable de l'administration
    // (components/admin/RepeaterField), et la faire correspondre au
    // schéma évite une traduction à l'aller comme au retour — une
    // conversion que le premier script d'import ou la première écriture
    // directe aurait oubliée.
    missions: {
      type: [lineSchema],
      validate: {
        validator: (v) => v.length <= 15,
        message: "15 missions maximum par poste.",
      },
      default: [],
    },

    requirements: {
      type: [lineSchema],
      validate: {
        validator: (v) => v.length <= 15,
        message: "15 éléments de profil maximum par poste.",
      },
      default: [],
    },

    commitment: {
      type: String,
      trim: true,
      maxlength: 600,
    },

    // Nombre de places, affiché tel quel (« 3 », « À déterminer ») :
    // c'est un renseignement, pas une contrainte que le site ferait
    // respecter.
    openings: {
      type: String,
      trim: true,
      maxlength: 60,
    },

    image: { type: String, trim: true },

    order: { type: Number, default: 0 },

    // Publié par défaut, comme les autres contenus : un poste créé
    // depuis l'administration doit apparaître sans manipulation
    // supplémentaire. « draft » sert à préparer une campagne,
    // « archived » à retirer un poste pourvu sans perdre sa fiche.
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
      index: true,
    },
  },
  { timestamps: true }
);

positionSchema.index({ status: 1, order: 1 });

export default mongoose.model("Position", positionSchema);
