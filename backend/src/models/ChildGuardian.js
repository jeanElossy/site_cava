import mongoose from "mongoose";

// Parent ou responsable d'un ou plusieurs enfants.
//
// ------------------------------------------------------------------
// POURQUOI UNE COLLECTION, ET NON UN SOUS-DOCUMENT DE `Child`
// ------------------------------------------------------------------
// Une fratrie partage ses parents. Embarqué dans chaque enfant, le
// même responsable serait saisi trois fois pour trois enfants — trois
// numéros de téléphone à corriger le jour d'un déménagement, et trois
// occasions de diverger. Le coût est une jointure de plus à
// l'affichage d'une fiche ; il est assumé.
//
// ------------------------------------------------------------------
// LE PARENT DÉJÀ MEMBRE CAVA
// ------------------------------------------------------------------
// `member` relie le responsable à sa fiche `Member` quand il en a une.
// Dans ce cas, l'identité fait autorité côté `Member` et les champs
// ci-dessous ne servent qu'à afficher sans jointure — ils sont
// recopiés à la liaison, et rafraîchis par le service. Un responsable
// externe (grand-mère, voisine, tuteur) n'a pas de fiche membre : ses
// champs sont alors la seule source.
const childGuardianSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      // `sparse` : la grande majorité des responsables externes n'ont
      // pas de fiche membre, et plusieurs valeurs absentes ne doivent
      // pas se heurter à l'unicité.
      unique: true,
      sparse: true,
    },

    firstName: {
      type: String,
      required: [true, "Le prénom est obligatoire."],
      trim: true,
      maxlength: 80,
    },

    lastName: {
      type: String,
      required: [true, "Le nom est obligatoire."],
      trim: true,
      maxlength: 80,
    },

    phone: { type: String, trim: true, maxlength: 40 },

    whatsapp: { type: String, trim: true, maxlength: 40 },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Adresse e-mail invalide."],
    },

    address: { type: String, trim: true, maxlength: 300 },

    // Quartier / commune, même champ que sur la fiche membre.
    area: { type: String, trim: true, maxlength: 120 },

    church: { type: Number, min: 1, max: 5 },

    // Notes internes de l'équipe. DONNÉES PERSONNELLES au second
    // degré : elles parlent d'un adulte à propos d'un enfant. Jamais
    // exposées hors de l'administration.
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      select: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

childGuardianSchema.index({ lastName: 1, firstName: 1 });
childGuardianSchema.index({ phone: 1 });

childGuardianSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

childGuardianSchema.set("toJSON", { virtuals: true });

export default mongoose.model("ChildGuardian", childGuardianSchema);
