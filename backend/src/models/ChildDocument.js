import mongoose from "mongoose";

import { isTrustedChildDocumentUrl } from "../utils/cloudinaryUrl.js";

export const CHILD_DOCUMENT_TYPES = [
  "acte_naissance",
  "piece_identite",
  "autorisation_parentale",
  "autorisation_participation",
  "certificat_medical",
  "informations_medicales",
  "autre",
];

// Formats acceptés et plafonds, repris des maquettes.
//
// Contrairement aux autres envois du projet, ces limites ne sont pas
// seulement vérifiées par le navigateur : elles entrent dans les
// PARAMÈTRES SIGNÉS envoyés à Cloudinary (voir upload.service.js), qui
// refuse alors lui-même tout fichier qui s'en écarte. Une vérification
// côté navigateur seule se contourne en trois clics.
export const CHILD_DOCUMENT_FORMATS = ["pdf", "jpg", "jpeg", "png"];

export const CHILD_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

// Plafond par ENFANT, pas par document : c'est ce que la fiche affiche
// (« 8.4 Mo sur 50 Mo autorisés »). Vérifié par le service avant de
// délivrer une signature d'envoi — refuser après coup laisserait un
// fichier orphelin sur Cloudinary, payé et invisible.
export const CHILD_DOCUMENT_QUOTA_BYTES = 50 * 1024 * 1024;

// Pièce jointe au dossier d'un enfant.
//
// ------------------------------------------------------------------
// COLLECTION SÉPARÉE, ET NON SOUS-DOCUMENT DE `Child`
// ------------------------------------------------------------------
// MongoDB renvoie un document entier : embarqués, les documents
// seraient chargés à chaque ouverture d'une fiche, et à chaque ligne
// d'une liste d'enfants. Le cahier des charges demande explicitement
// le contraire (« chargement différé des documents »).
//
// ------------------------------------------------------------------
// JAMAIS PUBLIC — CE N'EST PAS UNE PRÉCAUTION, C'EST LA RAISON D'ÊTRE
// ------------------------------------------------------------------
// Tous les autres envois du projet (photos de membres, médias, preuves
// de don) produisent une URL Cloudinary PUBLIQUE et permanente. C'est
// acceptable pour un portrait affiché sur une carte ; ça ne l'est pas
// pour l'acte de naissance d'un mineur : l'URL fuiterait par un journal
// de serveur, un historique de navigateur ou une capture d'écran, et
// resterait lisible pour toujours, sans authentification.
//
// D'où le mode `authenticated` de Cloudinary, imposé par le validateur
// ci-dessous : le fichier n'est atteignable que par une URL SIGNÉE à
// durée limitée, délivrée par l'API après vérification des droits et
// journalisée (voir childDocument.service.js et l'action d'audit
// `document_view`).
// Auteur d'un dépôt : un compte d'administration, un moniteur (qui en
// a un), ou un responsable de l'enfant (qui n'en a pas). Voir le
// commentaire sur `uploadedBy` plus bas.
const documentAuthorSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["user", "guardian"],
      required: true,
    },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, trim: true, maxlength: 160 },
    // Libellé affiché sous le nom (« Administrateur », « Moniteur »,
    // « Mère ») — figé à l'instant du dépôt, parce qu'il décrit la
    // qualité en vertu de laquelle la personne a agi CE jour-là.
    label: { type: String, trim: true, maxlength: 60 },
  },
  { _id: false }
);

const childDocumentSchema = new mongoose.Schema(
  {
    child: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: CHILD_DOCUMENT_TYPES,
      required: [true, "Le type de document est obligatoire."],
    },

    // Nom lisible, saisi ou déduit du fichier envoyé.
    name: {
      type: String,
      required: [true, "Le nom du document est obligatoire."],
      trim: true,
      maxlength: 160,
    },

    // Identifiant Cloudinary — c'est LUI qui sert à signer une URL de
    // consultation, pas l'URL stockée. Conservé séparément parce
    // qu'une URL signée expire, alors que l'identifiant, lui, ne
    // change jamais.
    publicId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    // URL de référence, conservée pour la traçabilité et la
    // suppression. Elle n'est JAMAIS renvoyée telle quelle au
    // navigateur : le service délivre une URL signée à la demande.
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value) => !value || isTrustedChildDocumentUrl(value),
        message:
          "Un document d'enfant doit être stocké en mode protégé, dans notre dossier dédié.",
      },
    },

    // « image » ou « raw » (un PDF n'est pas une image pour
    // Cloudinary) — nécessaire pour reconstruire l'URL signée.
    resourceType: {
      type: String,
      enum: ["image", "raw"],
      default: "image",
    },

    mimeType: { type: String, trim: true, maxlength: 120 },

    bytes: { type: Number, min: 0 },

    // Statut de validation.
    //
    // Un document déposé n'est pas un document vérifié : l'équipe
    // confirme qu'il est lisible, complet et bien du type annoncé. Les
    // maquettes comptent d'ailleurs les deux séparément (« 4 validés,
    // 1 en attente »).
    //
    // « refuse » existe pour qu'un document illisible puisse être
    // écarté SANS être supprimé — la suppression effacerait la trace du
    // dépôt, et le parent redéposerait le même fichier.
    status: {
      type: String,
      enum: ["en_attente", "valide", "refuse"],
      default: "en_attente",
      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reviewedAt: Date,

    reviewNote: { type: String, trim: true, maxlength: 300 },

    // QUI a déposé le document, et QUI l'a remplacé en dernier — les
    // deux sont demandés, et ils diffèrent souvent : le dépôt initial
    // est fait à l'inscription, le remplacement des mois plus tard.
    //
    // AUTEUR DÉNORMALISÉ, pas une simple référence `User` : les
    // maquettes montrent un document « ajouté par Marie ASSOGBA,
    // Mère », or un responsable n'a pas de compte. Même montage que
    // `authorSchema` dans NewSoul.js — un embed (kind + id + name)
    // plutôt qu'un `ref` polymorphe, ce qui permet aussi d'afficher le
    // nom sans jointure, et de garder la trace lisible si le compte
    // disparaît.
    uploadedBy: {
      type: documentAuthorSchema,
      required: true,
    },

    lastModifiedBy: documentAuthorSchema,
  },
  { timestamps: true }
);

// Regrouper les documents d'un enfant par type dans la fiche.
childDocumentSchema.index({ child: 1, type: 1 });

export default mongoose.model("ChildDocument", childDocumentSchema);
