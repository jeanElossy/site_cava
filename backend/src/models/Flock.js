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

    // RESPONSABLE DE LA BERGERIE
    //
    // Un seul, sans adjoint ni intérim : c'est la règle posée par
    // l'Église. Une collection d'affectations séparée (sur le modèle de
    // `MonitorAssignment`, qui doit gérer classe principale ET
    // remplacements) n'aurait donc rien à porter de plus qu'un champ —
    // elle n'aurait ajouté qu'une jointure à chaque lecture.
    //
    // C'est un MEMBRE que l'on désigne, pas un compte : la personne
    // existe dans l'annuaire avant d'avoir un accès, et son compte
    // (rôle `responsable_bergerie`) se crée ensuite. Les deux ne se
    // confondent pas — retirer un accès ne doit pas effacer le fait
    // qu'une bergerie a un responsable.
    leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      // Une liste déroulante sans sélection envoie une CHAÎNE VIDE, que
      // Mongoose ne sait pas convertir en ObjectId : l'enregistrement
      // aurait échoué sur « Cast to ObjectId failed » au moment précis
      // où l'administrateur retire un responsable. Le setter la traduit
      // en « pas de valeur », ce qui est bien ce que l'écran veut dire.
      //
      // Posé sur le MODÈLE et non sur l'écran : tout appelant est
      // couvert, y compris un script d'import ou un futur formulaire.
      set: (value) => (value === "" || value === null ? undefined : value),
    },

    // Permet de METTRE EN RETRAIT un responsable sans effacer la
    // désignation ni toucher à son compte. « suspendu » ferme l'accès
    // au portail tout en gardant trace de qui dirige la bergerie —
    // c'est précisément ce qu'un champ effacé ne saurait pas dire.
    leaderStatus: {
      type: String,
      enum: ["actif", "suspendu"],
      default: "actif",
      // Même raison qu'au-dessus, mais le repli est « actif » et NON
      // `undefined` : poser explicitement `undefined` court-circuite la
      // valeur par défaut de Mongoose, et le champ serait resté vide.
      // `resolveFlockAccess` exigeant « actif », une bergerie enregistrée
      // avec ce `<select>` laissé vide aurait eu un responsable désigné
      // à qui le portail restait fermé — sans le moindre message.
      set: (value) => (value === "" || value == null ? "actif" : value),
    },

    leaderSince: Date,
  },
  { timestamps: true }
);

flockSchema.index({ church: 1, code: 1 }, { unique: true });

// Un membre ne dirige qu'une bergerie à la fois.
//
// Index PARTIEL : sans la condition, tous les documents sans
// responsable partageraient la valeur `null` et se seraient exclus
// mutuellement — une seule bergerie aurait pu rester sans responsable.
flockSchema.index(
  { leader: 1 },
  {
    unique: true,
    partialFilterExpression: { leader: { $exists: true, $type: "objectId" } },
  }
);

// La date de désignation suit le responsable, et se pose toute seule :
// laissée à l'appelant, elle aurait manqué au premier script d'import
// ou à la première écriture directe en base.
const applyLeaderSince = function (next) {
  if (this.isModified("leader")) {
    this.leaderSince = this.leader ? new Date() : undefined;
  }

  next();
};

flockSchema.pre("save", applyLeaderSince);

flockSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();

  if (!update) return next();

  // Mongoose accepte les deux formes — `{ champ: valeur }` (utilisée
  // par crud.service.js) et `{ $set: {...} }`.
  const target = update.$set ?? update;

  if (Object.prototype.hasOwnProperty.call(target, "leader")) {
    target.leaderSince = target.leader ? new Date() : undefined;

    this.setUpdate(update);
  }

  next();
});

export default mongoose.model("Flock", flockSchema);
