import mongoose from "mongoose";

export const CHILD_ATTENDANCE_STATUSES = ["present", "absent", "excuse"];

// Présence d'un enfant à une séance.
//
// ------------------------------------------------------------------
// IDEMPOTENCE : L'INDEX UNIQUE, PAS UNE LECTURE PRÉALABLE
// ------------------------------------------------------------------
// L'index `{child, session}` garantit qu'un enfant n'a qu'UNE ligne par
// séance. Le service s'appuie dessus (`bulkWrite` en upsert) plutôt que
// de vérifier « à la main » avant d'écrire : « Tous présents » envoie
// vingt-quatre lignes d'un coup, et deux moniteurs peuvent appuyer
// presque en même temps. Même parti pris que `Attendance` pour le
// badgeage des adultes.
//
// ------------------------------------------------------------------
// L'AUDIT DU REMPLACEMENT TIENT DANS UN SEUL CHAMP
// ------------------------------------------------------------------
// Le cahier des charges veut retrouver, des mois plus tard : « présence
// enregistrée par Sarah, classe 9–11 ans, en remplacement de Jean ».
//
// `substitution` suffit : il porte le remplaçant, le remplacé, la
// classe et le motif. Recopier deux noms dans chaque ligne de présence
// les figerait au moment de l'appel — ce qui semble prudent, mais rend
// impossible de corriger une faute de frappe sur un nom sans réécrire
// des centaines de lignes.
const childAttendanceSchema = new mongoose.Schema(
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

    // Dénormalisée depuis la séance : c'est le seul champ recopié, et
    // il l'est parce que toutes les statistiques filtrent par classe.
    // Passer par la séance imposerait une jointure à chaque agrégat.
    // La classe d'une séance ne change jamais (l'index unique
    // `{class, date}` l'interdirait de fait), donc aucune divergence
    // possible.
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SundaySchoolClass",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: CHILD_ATTENDANCE_STATUSES,
      required: true,
    },

    // Le MONITEUR qui a fait l'appel — un `Member`, pas un `User` :
    // c'est la personne qui était dans la salle. Son compte peut être
    // supprimé sans que la trace devienne illisible.
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    recordedAt: {
      type: Date,
      default: Date.now,
    },

    // Renseigné UNIQUEMENT si l'appel a été fait au titre d'un
    // remplacement. Absent, la présence a été prise par un moniteur de
    // la classe — voir l'en-tête.
    substitution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MonitorSubstitution",
    },

    // Correction après coup. Distincts de `recordedBy`/`recordedAt`
    // exprès : savoir qu'une présence a été modifiée, par qui et quand,
    // est plus utile que de savoir seulement son état final.
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
    },

    lastModifiedAt: Date,

    // Motif d'une absence excusée (« malade », « en voyage »).
    note: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: false }
);

// Voir l'en-tête : c'est cet index qui rend l'appel rejouable sans
// créer de doublon.
childAttendanceSchema.index({ child: 1, session: 1 }, { unique: true });

// Feuille d'appel d'une séance.
childAttendanceSchema.index({ session: 1, status: 1 });

// Historique d'un enfant, du plus récent au plus ancien — PAGINÉ :
// une fiche ne charge jamais l'historique complet.
childAttendanceSchema.index({ child: 1, date: -1 });

// Statistiques par classe sur une période.
childAttendanceSchema.index({ class: 1, date: -1 });

export default mongoose.model("ChildAttendance", childAttendanceSchema);
