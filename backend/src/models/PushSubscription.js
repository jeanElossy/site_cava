import mongoose from "mongoose";

// Abonnement navigateur (Web Push) d'un compte agent — voir
// push.service.js. Un même compte peut avoir plusieurs abonnements
// (téléphone + ordinateur, ou plusieurs navigateurs) : chaque appareil
// s'abonne séparément, `endpoint` les distingue de façon unique.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // URL propre au navigateur/appareil, fournie par le Push API —
    // c'est elle que le service de push (Google, Mozilla...) utilise
    // pour router la notification, pas nous.
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },

    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ user: 1 });

export default mongoose.model("PushSubscription", pushSubscriptionSchema);
