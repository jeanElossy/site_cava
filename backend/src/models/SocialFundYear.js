import mongoose from "mongoose";

// Exercice annuel de la caisse sociale : UNE caisse par église et par
// année civile, là où le module n'en connaissait qu'une seule,
// perpétuelle, depuis l'activation (`SocialFundSettings.openingBalance`
// + la totalité des `SocialLedgerEntry` de l'église).
//
// ------------------------------------------------------------------
// À QUEL EXERCICE APPARTIENT UN MOUVEMENT ?
// ------------------------------------------------------------------
// À celui de la DATE D'ENREGISTREMENT du mouvement, jamais à celui du
// mois cotisé. C'est une comptabilité de caisse : l'argent entre
// physiquement dans la caisse le jour où l'agent l'encaisse. Un membre
// qui règle en 2027 son arriéré de mars 2025 alimente donc la caisse
// 2027 — sa dette, elle, reste bien datée de 2025 côté
// `SocialContribution`, qui porte `year`/`month` pour ça.
//
// Conséquence utile : un exercice révolu ne peut plus recevoir aucune
// écriture (l'horloge serveur ne revient pas en arrière), donc son
// solde de clôture est définitif dès le 1er janvier suivant. C'est ce
// qui autorise à STOCKER `openingBalance` comme report, sans risque de
// le voir diverger d'un recalcul ultérieur.
//
// ------------------------------------------------------------------
// REPORT DU SOLDE
// ------------------------------------------------------------------
// `openingBalance` de l'exercice N = solde de clôture de l'exercice
// N-1 (décision de cadrage du client : le solde est reporté, chaque
// caisse ne repart pas de zéro). Pour le tout premier exercice
// (SOCIAL_START_YEAR, soit 2026), il n'y a rien à reporter : la
// trésorerie d'avant le module n'a pas d'historique exploitable. Son
// `openingBalance` se saisit à la main, à l'ouverture, s'il y avait
// une caisse antérieure à reprendre.
const socialFundYearSchema = new mongoose.Schema(
  {
    church: {
      type: Number,
      required: [true, "L'église est obligatoire."],
      min: 1,
      max: 5,
    },

    year: {
      type: Number,
      required: [true, "L'année de l'exercice est obligatoire."],
      min: [2000, "Année d'exercice invalide."],
      max: [2100, "Année d'exercice invalide."],
    },

    // Volontairement SANS `min: 0` : c'est un report, pas une saisie.
    // Le solde d'un exercice ne peut pas descendre sous zéro en
    // pratique (socialAid.service.js#validateAid refuse tout
    // décaissement supérieur au solde disponible), mais contraindre le
    // report ferait échouer une clôture plutôt que de refléter la
    // réalité si cette invariante venait à être contournée. La saisie
    // manuelle du tout premier exercice, elle, est bien validée
    // positive côté service.
    openingBalance: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["ouvert", "cloture"],
      default: "ouvert",
      index: true,
    },

    // Photographie du solde au moment de la clôture. Redondant avec
    // `openingBalance + somme des mouvements de l'année` — c'est
    // volontaire : la valeur figée est la trace de ce que le
    // responsable a validé, et sert de contrôle si les deux devaient
    // un jour diverger.
    closingBalance: Number,
    closedAt: Date,
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Une seule caisse par église et par année — garde-fou du
// `findOneAndUpdate(..., { upsert: true })` d'ouverture, qui peut être
// déclenché en parallèle par deux agents encaissant au même instant le
// 1er janvier.
socialFundYearSchema.index({ church: 1, year: 1 }, { unique: true });

export default mongoose.model("SocialFundYear", socialFundYearSchema);
