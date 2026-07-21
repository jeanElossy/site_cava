import crypto from "node:crypto";

import mongoose from "mongoose";

// Dons encaissés via le prestataire de paiement.
//
// ------------------------------------------------------------------
// CE QUE CE MODÈLE NE STOCKE PAS
// ------------------------------------------------------------------
// Aucune donnée de carte bancaire, jamais : numéro, date d'expiration,
// cryptogramme. Le donateur saisit ses coordonnées de paiement sur la
// page hébergée du prestataire, pas sur notre site. C'est ce qui nous
// maintient hors du périmètre PCI-DSS — y entrer imposerait un audit
// annuel hors de portée d'une église.
//
// ------------------------------------------------------------------
// LE MONTANT FAIT AUTORITÉ CÔTÉ SERVEUR
// ------------------------------------------------------------------
// `amount` est figé à la création, avant tout appel au prestataire, et
// n'est plus jamais réécrit depuis une requête entrante. À la
// confirmation, le montant réellement payé est comparé à celui-ci : un
// écart marque le don « suspect » au lieu de l'encaisser. Sans cette
// comparaison, il suffirait de rejouer une notification avec un montant
// gonflé pour créer un reçu de 500 000 F à partir d'un paiement de 500 F.

const donationSchema = new mongoose.Schema(
  {
    // Référence publique, la seule qui circule dans les URL et les
    // e-mails. Aléatoire et non devinable : un identifiant Mongo, même
    // opaque en apparence, reste séquentiel dans le temps et laisserait
    // énumérer les dons des autres.
    reference: {
      type: String,
      unique: true,
      index: true,
      default: () =>
        `CAVA-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
    },

    // ---- Ce que le donateur a demandé ----------------------------

    amount: {
      type: Number,
      required: [true, "Le montant est obligatoire."],
      min: [200, "Le montant minimum est de 200 F CFA."],
      max: [10000000, "Le montant maximum est de 10 000 000 F CFA."],
    },

    currency: {
      type: String,
      enum: ["XOF"],
      default: "XOF",
    },

    contributionType: {
      type: String,
      enum: ["dime", "offrande", "don", "grace", "projet"],
      default: "don",
      index: true,
    },

    project: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "general",
    },

    recurring: { type: Boolean, default: false },

    // Moyen choisi dans le tunnel. Indicatif : le donateur peut encore
    // changer d'avis sur la page du prestataire, et c'est alors
    // `paidWith` qui dit la vérité.
    paymentMethod: {
      type: String,
      enum: ["orange", "mtn", "moov", "wave", "card"],
      required: true,
    },

    paidWith: { type: String, trim: true, maxlength: 40 },

    // ---- Le donateur ---------------------------------------------
    //
    // Un don anonyme n'enregistre ni nom ni contact. Le champ `anonymous`
    // n'est donc pas un simple affichage : il conditionne ce qui est
    // écrit en base.
    donor: {
      firstName: { type: String, trim: true, maxlength: 60 },
      lastName: { type: String, trim: true, maxlength: 60 },
      phone: { type: String, trim: true, maxlength: 30 },
      email: { type: String, trim: true, lowercase: true, maxlength: 160 },
      anonymous: { type: Boolean, default: false },
    },

    // ---- Cycle de vie --------------------------------------------
    //
    //   pending   : créé chez nous, donateur envoyé chez le prestataire
    //   paid      : paiement confirmé ET re-vérifié auprès du prestataire
    //   failed    : refusé, annulé, ou expiré
    //   suspect   : confirmé mais incohérent (montant ou devise différents)
    //
    // « suspect » existe pour ne jamais avoir à choisir entre encaisser
    // à tort et perdre la trace d'un paiement : le don est conservé,
    // signalé, et traité à la main.
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "suspect"],
      default: "pending",
      index: true,
    },

    // Identifiant de la transaction chez le prestataire.
    providerTransactionId: { type: String, trim: true, maxlength: 120 },

    provider: {
      type: String,
      enum: ["cinetpay"],
      default: "cinetpay",
    },

    // Réponse brute de la vérification, conservée telle quelle.
    //
    // En cas de litige avec un donateur (« j'ai payé, ce n'est pas
    // arrivé »), c'est la seule preuve de ce que le prestataire a
    // réellement répondu, et à quel instant.
    providerPayload: {
      type: mongoose.Schema.Types.Mixed,
      select: false,
    },

    failureReason: { type: String, trim: true, maxlength: 200 },

    paidAt: Date,

    // Horodatage de la première notification traitée. Sert de garde
    // d'idempotence : le prestataire renvoie sa notification plusieurs
    // fois jusqu'à recevoir un 200, et deux traitements simultanés
    // doubleraient les totaux.
    confirmedAt: Date,

    // Traçabilité de l'origine. Sans conserver l'IP complète plus que
    // nécessaire, elle aide à repérer une série de tentatives frauduleuses.
    ip: { type: String, trim: true, maxlength: 60 },
  },
  { timestamps: true }
);

// Les deux lectures faites par l'administration : la liste récente, et
// le filtre par statut.
donationSchema.index({ status: 1, createdAt: -1 });
donationSchema.index({ createdAt: -1 });

// Un don anonyme ne doit pas laisser d'identité derrière lui, même si
// le formulaire a été rempli avant que la case soit cochée.
donationSchema.pre("validate", function stripAnonymousDonor() {
  if (this.donor?.anonymous) {
    this.donor.firstName = undefined;
    this.donor.lastName = undefined;
    this.donor.phone = undefined;
    this.donor.email = undefined;
  }
});

donationSchema.set("toJSON", {
  transform: (_doc, ret) => {
    // La réponse brute du prestataire peut contenir des éléments
    // techniques sans intérêt pour le client, et n'a rien à faire dans
    // une réponse d'API.
    delete ret.providerPayload;

    return ret;
  },
});

export default mongoose.model("Donation", donationSchema);
