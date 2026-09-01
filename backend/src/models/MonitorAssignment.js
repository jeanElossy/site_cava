import mongoose from "mongoose";

// Fonction « moniteur / monitrice de l'École du dimanche » attribuée à
// un membre adulte.
//
// ------------------------------------------------------------------
// TROIS OBJETS, TROIS RÔLES — NE JAMAIS LES CONFONDRE
// ------------------------------------------------------------------
//   `Member`             la PERSONNE : Sarah, sa fiche, son matricule.
//                        Ce modèle-ci ne la modifie jamais.
//   `User`               le COMPTE de connexion (role "moniteur"),
//                        relié au membre par son matricule — même
//                        montage que les comptes agents, voir
//                        agent.service.js.
//   `MonitorAssignment`  la FONCTION : la classe principale, le
//                        statut, l'église.
//
// Séparer la fonction du compte n'est pas de la théorie : on retire la
// fonction d'un moniteur qui déménage sans supprimer son compte, et on
// désactive l'accès d'un moniteur en congé sans lui retirer sa classe.
// Fusionner les deux obligerait à choisir entre les deux.
//
// Un membre n'a JAMAIS deux comptes : s'il est déjà agent SOA, on
// ajoute une fonction, pas une identité.
const monitorAssignmentSchema = new mongoose.Schema(
  {
    // La personne. Un membre ne peut avoir qu'UNE fiche de monitorat —
    // d'où l'unicité. Encadrer une seconde classe se fait par un
    // remplacement (voir MonitorSubstitution.js), jamais par une
    // seconde affectation permanente : c'est précisément la règle du
    // cahier des charges (« le remplacement ne modifie pas la classe
    // principale »).
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: [true, "Le membre est obligatoire."],
      unique: true,
    },

    // Le compte de connexion, quand l'accès a été ouvert. Absent tant
    // que l'administrateur n'a pas créé l'accès : on peut être moniteur
    // sans jamais se connecter — beaucoup le seront.
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // CLASSE PRINCIPALE : l'affectation permanente. C'est elle, et elle
    // seule, qui donne un accès qui ne s'éteint pas.
    primaryClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SundaySchoolClass",
      required: [true, "La classe principale est obligatoire."],
    },

    church: {
      type: Number,
      required: [true, "L'église est obligatoire."],
      min: 1,
      max: 5,
    },

    // Distinction utile aux listes de classe : le responsable de la
    // classe et son second n'ont pas les mêmes droits d'accès (ils ont
    // les mêmes), mais pas le même rôle d'organisation.
    level: {
      type: String,
      enum: ["principal", "secondaire"],
      default: "principal",
    },

    assignedAt: { type: Date, default: Date.now },

    // ÉTAT DE LA FONCTION, distinct de `User.isActive` qui est l'état
    // du COMPTE. Un moniteur « suspendu » garde sa classe mais ne doit
    // plus y accéder ; un moniteur « retire » n'a plus de classe du
    // tout. Les deux gardent leur fiche membre intacte.
    status: {
      type: String,
      enum: ["active", "suspendue", "retiree"],
      default: "active",
      index: true,
    },

    notes: { type: String, trim: true, maxlength: 1000, select: false },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Liste des moniteurs d'une classe — affichée sur la fiche de chaque
// enfant de cette classe, donc requête fréquente.
monitorAssignmentSchema.index({ primaryClass: 1, status: 1 });

monitorAssignmentSchema.index({ church: 1, status: 1 });

export default mongoose.model("MonitorAssignment", monitorAssignmentSchema);
