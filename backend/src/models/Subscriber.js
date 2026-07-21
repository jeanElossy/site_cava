import crypto from "node:crypto";

import mongoose from "mongoose";

// Abonnés à la lettre d'information.
//
// Entité distincte de `Member` : s'abonner à des nouvelles n'est pas
// devenir membre de l'église. Les mélanger reviendrait à traiter une
// simple adresse e-mail avec les mêmes obligations qu'un dossier de
// membre, et à priver l'administration d'une distinction utile.
//
// Aucune suppression automatique : conformément à la demande, une
// adresse reste jusqu'à désinscription de la personne ou suppression
// par un administrateur.
const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "L'adresse e-mail est obligatoire."],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 160,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Adresse e-mail invalide.",
      ],
    },

    // Facultatif : le formulaire du pied de page ne demande que
    // l'adresse. Le champ existe pour un futur formulaire plus complet.
    name: { type: String, trim: true, maxlength: 80 },

    // « pending » tant que l'adresse n'a pas été confirmée par un clic
    // dans un e-mail. Le double consentement n'est pas encore actif
    // faute de service d'envoi : les inscriptions sont donc créées
    // directement en « confirmed ». Le statut est en place pour que le
    // passage au double consentement ne demande pas de migration.
    status: {
      type: String,
      enum: ["pending", "confirmed", "unsubscribed"],
      default: "confirmed",
      index: true,
    },

    confirmedAt: Date,
    unsubscribedAt: Date,

    // D'où vient l'inscription : utile pour mesurer ce qui fonctionne,
    // et pour prouver l'origine du consentement en cas de contestation.
    source: {
      type: String,
      enum: ["footer", "admin", "import", "autre"],
      default: "footer",
    },

    // Preuve du consentement. Sans elle, impossible de démontrer que
    // la personne s'est inscrite elle-même — c'est ce qui distingue une
    // liste légitime d'une liste constituée à l'insu des gens.
    consentAt: { type: Date, default: Date.now },
    consentIp: { type: String, trim: true, maxlength: 60 },

    // Jeton de désinscription, à placer dans chaque envoi.
    //
    // Indispensable : sans lien de désinscription, un envoi est un
    // spam au sens de la loi. Un jeton aléatoire plutôt que l'adresse
    // en clair dans l'URL, pour qu'un lien intercepté ne permette pas
    // de désabonner n'importe qui en devinant son adresse.
    unsubscribeToken: {
      type: String,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(24).toString("hex"),
    },
  },
  { timestamps: true }
);

subscriberSchema.index({ status: 1, createdAt: -1 });

// Les adresses réellement destinataires d'un envoi.
subscriberSchema.statics.mailable = function () {
  return this.find({ status: "confirmed" })
    .select("email name unsubscribeToken")
    .lean();
};

subscriberSchema.set("toJSON", {
  transform: (_doc, ret) => {
    // Le jeton ne sort jamais par les routes de lecture : il ne sert
    // qu'à construire les liens de désinscription au moment de l'envoi.
    delete ret.unsubscribeToken;

    return ret;
  },
});

export default mongoose.model("Subscriber", subscriberSchema);
