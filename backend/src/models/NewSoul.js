import mongoose from "mongoose";

// Dossier d'une "nouvelle âme", du premier accueil (SOA) jusqu'à la
// clôture du parcours d'accompagnement (CANA), sur le modèle de la
// fiche officielle papier CANA (ÇA.VA.).
//
// UN SEUL DOCUMENT pour tout le parcours, avec `soa` et `cana`
// imbriqués : la CANA ne doit jamais ressaisir une information déjà
// saisie par le SOA (exigence métier explicite) — avec deux
// collections séparées, cette règle ne serait qu'une convention de
// code à faire respecter partout ; ici, l'information n'existe
// physiquement qu'à un seul endroit.
//
// Les lettres de section (A, B, C...) dans les commentaires renvoient
// aux sections de la fiche officielle papier, pour vérifier qu'aucun
// champ n'a été oublié lors d'une évolution future.

export const NEW_SOUL_STATUSES = [
  "nouveau",
  "enregistre_soa",
  "attente_cana",
  "premier_contact",
  "entretien_planifie",
  "en_accompagnement",
  "orientation_specialisee",
  "formation_en_cours",
  "integration_bergerie",
  "cloture",
];

// Statuts à partir desquels le SOA peut encore modifier `soa.*` — au
// delà (une fois transmis), la section est verrouillée (voir
// `soa.lockedAt`).
export const SOA_EDITABLE_STATUSES = ["nouveau", "enregistre_soa"];

// Identité de l'auteur d'une action — un dossier peut être créé/
// transmis soit par un compte admin (`User`, rôle soa/admin), soit par
// un agent de badgeage des présences (`Member`, authentifié par
// matricule via presenceAuth.js). Deux collections, deux espaces
// d'identifiants : un embed dénormalisé (kind + id + name) plutôt
// qu'une référence unique évite un `ref` polymorphe et permet
// d'afficher le nom sans repeupler depuis l'une ou l'autre collection
// à chaque lecture (voir newSoul.service.js).
const authorSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["user", "member"], required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, trim: true, maxlength: 160 },
  },
  { _id: false }
);

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: NEW_SOUL_STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: authorSchema,
    note: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false }
);

// --- SOA : sections A à G de la fiche -------------------------------

const soaSchema = new mongoose.Schema(
  {
    // A. Identification du dossier
    openedAt: { type: Date, default: Date.now },
    firstVisitAt: Date,
    service: { type: String, trim: true, maxlength: 160 }, // culte / activité
    agent: authorSchema,

    // B. Informations essentielles
    firstName: { type: String, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, maxlength: 80 },
    gender: { type: String, enum: ["homme", "femme"] },
    category: { type: String, enum: ["enfant", "adolescent", "adulte"] },
    phone: { type: String, trim: true, maxlength: 40 },
    whatsapp: { type: String, trim: true, maxlength: 40 },
    area: { type: String, trim: true, maxlength: 120 },
    landmark: { type: String, trim: true, maxlength: 200 }, // repère géographique

    // Moyen de contact préféré
    preferredContactMethod: {
      type: String,
      enum: ["appel", "appel_whatsapp", "message_whatsapp", "sms"],
    },
    availableTimes: { type: String, trim: true, maxlength: 200 },

    // C. Circonstances du premier contact
    origin: {
      type: String,
      enum: [
        "evangelisation",
        "invitation",
        "culte_spontane",
        "campagne",
        "reseaux_sociaux",
        "recommandation",
        "demande_personnelle",
        "autre",
      ],
    },
    originOther: { type: String, trim: true, maxlength: 200 },
    invitedBy: { type: String, trim: true, maxlength: 160 },
    firstVisit: { type: String, enum: ["oui", "non", "non_precise"] },
    attendingSince: { type: String, trim: true, maxlength: 200 },

    // D. Situation spirituelle déclarée
    decision: {
      type: String,
      enum: [
        "accepte_recemment",
        "deja_accepte",
        "desire_accepter",
        "revient_a_dieu",
        "recherche_eglise",
        "veut_connaitre_foi",
        "ne_sait_pas",
        "autre",
      ],
    },
    decisionOther: { type: String, trim: true, maxlength: 200 },
    waterBaptism: { type: String, enum: ["oui", "non", "a_verifier"] },
    waterBaptismYear: { type: String, trim: true, maxlength: 40 },
    currentChurch: { type: String, enum: ["oui", "non", "occasionnellement", "a_preciser"] },
    currentChurchName: { type: String, trim: true, maxlength: 160 },
    observations: { type: String, trim: true, maxlength: 1000 },

    // E. Besoins et demandes exprimés
    needs: {
      type: [
        {
          type: String,
          enum: [
            "comprendre_salut",
            "apprendre_prier",
            "lire_bible",
            "fondements",
            "accompagnement",
            "ecoute_pastorale",
            "soutien_social",
            "priere",
            "visite",
            "preparation_bapteme",
            "decouvrir_cava",
            "autre",
          ],
        },
      ],
      default: [],
    },
    needsOther: { type: String, trim: true, maxlength: 200 },
    needsDetails: { type: String, trim: true, maxlength: 1000 },

    // F. Accord pour être contacté(e)
    consent: { type: String, enum: ["oui", "non", "a_confirmer"] },
    consentDate: Date,
    consentCollectedBy: { type: String, trim: true, maxlength: 160 },

    // G. Transmission du dossier à la CANA
    transmittedAt: Date,
    transmittedBy: { type: String, trim: true, maxlength: 160 },
    completeness: { type: String, enum: ["complet", "a_completer"] },
    missingInfo: { type: String, trim: true, maxlength: 500 },

    // Verrouillage : posé par newSoul.service.js#transmit, jamais par
    // l'API directement — voir SOA_EDITABLE_STATUSES.
    lockedAt: Date,
  },
  { _id: false }
);

// --- CANA : plan et suivis (tableaux dynamiques) ---------------------

const planEntrySchema = new mongoose.Schema(
  {
    need: { type: String, trim: true, maxlength: 200 },
    action: { type: String, trim: true, maxlength: 200 },
    owner: { type: String, trim: true, maxlength: 160 },
    date: Date,
    result: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const monthlyFollowUpSchema = new mongoose.Schema(
  {
    // "mois_1".."mois_4" pour les 4 mois standard ; une valeur libre
    // reste possible pour un suivi exceptionnel au-delà (voir §P,
    // "Accompagnement à prolonger exceptionnellement").
    period: { type: String, trim: true, maxlength: 40, required: true },
    objective: { type: String, trim: true, maxlength: 300 },
    reviewDate: Date,
    observedSituation: { type: String, trim: true, maxlength: 1000 },
    decision: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// --- CANA : sections H à R de la fiche --------------------------------

const canaSchema = new mongoose.Schema(
  {
    // Accusé de réception — posé par newSoul.service.js#acknowledge à
    // la toute première ouverture du dossier par la CANA, jamais
    // ressaisi manuellement.
    acknowledgedAt: Date,
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // H. Ouverture administrative du parcours
    receivedAt: Date,
    openedAt: Date,
    expectedEndAt: Date, // 4 mois après l'ouverture, calculé mais modifiable
    responsable: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    coordinateurBergeries: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    review: {
      type: [
        {
          type: String,
          enum: [
            "dossier_exploitable",
            "info_complementaires_demandees",
            "coordonnees_a_verifier",
            "accord_a_confirmer",
          ],
        },
      ],
      default: [],
    },
    reviewObservations: { type: String, trim: true, maxlength: 1000 },

    // I. Premier contact effectué par la CANA
    firstContactDeadline: Date, // réception + 48h, calculé
    firstContactAttemptAt: Date,
    firstContactMethod: {
      type: String,
      enum: ["appel", "appel_whatsapp", "message_whatsapp", "sms"],
    },
    firstContactResult: {
      type: String,
      enum: [
        "contact_etabli",
        "disposee_accompagnement",
        "entretien_accepte",
        "entretien_a_confirmer",
        "a_rappeler",
        "injoignable",
        "coordonnees_incorrectes",
        "refus",
      ],
    },
    firstContactSummary: { type: String, trim: true, maxlength: 1000 },
    firstContactNextAction: { type: String, trim: true, maxlength: 300 },
    firstContactNextActionDate: Date,

    // J. Programmation de l'entretien initial
    interviewDate: Date,
    interviewResponsablePresent: Boolean,
    interviewCoordinateurPresent: Boolean,
    interviewMode: {
      type: String,
      enum: ["eglise", "autre_lieu", "domicile", "appel", "appel_video", "autre"],
    },
    interviewModeOther: { type: String, trim: true, maxlength: 160 },
    interviewLocation: { type: String, trim: true, maxlength: 300 },
    interviewDone: Boolean,
    interviewRescheduledDate: Date,

    // K. Informations personnelles complémentaires
    dateOfBirth: Date,
    maritalStatus: {
      type: String,
      enum: ["celibataire", "fiance", "marie", "veuf", "separe", "autre", "non_precise"],
    },
    maritalStatusOther: { type: String, trim: true, maxlength: 160 },
    profession: { type: String, trim: true, maxlength: 160 },
    workplace: { type: String, trim: true, maxlength: 200 },
    availability: { type: String, trim: true, maxlength: 300 },
    currentSituation: {
      type: String,
      enum: ["en_activite", "recherche_emploi", "etudiant", "retraite", "autre"],
    },
    currentSituationOther: { type: String, trim: true, maxlength: 160 },

    // L.1 Salut et vie chrétienne
    understandsSalvation: { type: String, enum: ["oui", "partiellement", "non", "a_approfondir"] },
    prays: { type: String, enum: ["regulierement", "occasionnellement", "pas_encore"] },
    readsBible: {
      type: String,
      enum: ["regulierement", "occasionnellement", "pas_encore", "sans_bible"],
    },
    receivedFoundations: { type: String, enum: ["oui", "partiellement", "non", "ne_sait_pas"] },
    spiritualObservations: { type: String, trim: true, maxlength: 1000 },

    // L.2 Parcours ecclésial
    previousChurch: { type: String, trim: true, maxlength: 200 },
    previousChurchDuration: { type: String, trim: true, maxlength: 120 },
    previousChurchResponsibility: { type: String, trim: true, maxlength: 200 },
    departureReason: { type: String, trim: true, maxlength: 500 },
    situationClarified: {
      type: String,
      enum: ["oui", "non", "non_applicable", "necessite_accompagnement"],
    },

    // L.3 Besoins d'intercession
    prayerMainSubject: { type: String, trim: true, maxlength: 500 },
    prayerOtherSubjects: { type: String, trim: true, maxlength: 500 },
    prayerTransmissionAllowed: { type: String, enum: ["oui", "non", "forme_generale"] },
    prayerConfidentiality: {
      type: String,
      enum: ["avec_nom", "sans_nom", "responsables_autorises"],
    },
    prayerFollowUpType: { type: String, enum: ["ponctuelle", "reguliere", "a_reevaluer"] },

    // L.4 Besoin d'accompagnement spirituel spécialisé (délivrance)
    deliveranceNeeded: { type: String, enum: ["oui", "non", "discernement_pastoral"] },
    deliveranceAccepted: { type: String, enum: ["oui", "non", "veut_explications"] },
    deliveranceReason: { type: String, trim: true, maxlength: 500 },
    // Sensible : jamais renvoyé à soa/coordinateur_bergeries — filtré
    // explicitement dans newSoul.service.js#serialize, pas seulement
    // par convention.
    deliveranceConfidentialNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      select: false,
    },

    // L.5 Besoin de rencontre pastorale
    pastoralMeetingNeeded: { type: String, enum: ["oui", "non", "a_evaluer"] },
    pastoralMeetingReason: {
      type: [
        {
          type: String,
          enum: [
            "conseil_pastoral",
            "situation_familiale",
            "situation_ecclesiale",
            "question_doctrinale",
            "besoin_ecoute",
            "decision_spirituelle",
            "autre",
          ],
        },
      ],
      default: [],
    },
    pastoralMeetingPriority: { type: String, enum: ["normale", "prioritaire", "ulterieure"] },

    // L.6 Situation sociale
    socialNeed: { type: String, enum: ["oui", "non", "a_approfondir"] },
    socialNeedAreas: {
      type: [
        {
          type: String,
          enum: [
            "alimentation",
            "logement",
            "sante",
            "travail",
            "scolarite",
            "situation_familiale",
            "orientation_administrative",
            "autre",
          ],
        },
      ],
      default: [],
    },
    socialCommissionReferral: Boolean,
    socialObservations: { type: String, trim: true, maxlength: 1000 },

    // L.7 Besoin de formation — IFIP.VIE
    trainingNeeded: { type: String, enum: ["oui", "non", "a_evaluer"] },
    trainingRecommended: { type: String, trim: true, maxlength: 200 },
    trainingAvailability: { type: String, trim: true, maxlength: 300 },
    trainingDifficulty: {
      type: String,
      enum: ["aucune", "accompagnement_adapte", "a_verifier"],
    },

    // L.8 Situation relationnelle et disponibilité
    knowsMembers: Boolean,
    knownMembersNames: { type: String, trim: true, maxlength: 300 },
    hasTransport: { type: String, enum: ["oui", "non", "occasionnellement"] },
    facesObstacles: { type: String, enum: ["oui", "non", "a_preciser"] },
    obstaclesDetails: { type: String, trim: true, maxlength: 500 },
    visitPossible: { type: String, enum: ["oui", "non", "ulterieurement"] },

    // M. Orientations décidées par la CANA
    orientations: {
      type: [
        {
          type: String,
          enum: [
            "intercession",
            "suivi_priere",
            "entretien_delivrance",
            "seance_delivrance",
            "rencontre_pasteur",
            "commission_sociale",
            "ifip_vie",
            "appels_reguliers",
            "messages_encouragement",
            "visite",
            "accompagnement_priere_lecture",
            "preparation_bergerie",
            "aucune",
            "autre",
          ],
        },
      ],
      default: [],
    },
    orientationsOther: { type: String, trim: true, maxlength: 200 },
    plan: { type: [planEntrySchema], default: [] },
    planValidated: Boolean,
    planValidatedAt: Date,
    orientationsExplained: Boolean,
    personAgreed: Boolean,

    // O. Suivi mensuel (bilans des 4 mois)
    monthlyFollowUps: { type: [monthlyFollowUpSchema], default: [] },
    checkpoints: {
      type: [
        {
          type: String,
          enum: [
            "contacts_reguliers",
            "participation_cultes",
            "participation_formation",
            "orientations_realisees",
            "evolution_besoins",
            "visite_realisee",
            "progression_spirituelle",
            "preparation_bergerie",
            "vigilance_particuliere",
          ],
        },
      ],
      default: [],
    },

    // P. Évaluation de fin de parcours
    finalReviewDate: Date,
    finalReviewResponsablePresent: Boolean,
    finalReviewCoordinateurPresent: Boolean,
    finalSituation: {
      type: [
        {
          type: String,
          enum: [
            "suivie_regulierement",
            "fondements_en_cours",
            "participation_reguliere",
            "formation_en_cours_ou_achevee",
            "besoins_specialises_pris_en_charge",
            "prete_integration",
            "prolongement_exceptionnel",
            "orientation_pastorale_necessaire",
            "parcours_interrompu",
            "ne_souhaite_plus_poursuivre",
          ],
        },
      ],
      default: [],
    },
    finalSummary: { type: String, trim: true, maxlength: 2000 },

    // Q. Orientation vers une bergerie
    flock: { type: mongoose.Schema.Types.ObjectId, ref: "Flock" },
    flockReason: { type: String, trim: true, maxlength: 500 },
    shepherd: { type: String, trim: true, maxlength: 160 },
    flockDecisionDate: Date,
    flockTransmissionDate: Date,
    flockContactDate: Date,
    flockFirstParticipationDate: Date,
    integrationConfirmed: { type: String, enum: ["oui", "non", "en_attente"] },
    integrationConfirmedAt: Date,
    integrationConfirmedBy: { type: String, trim: true, maxlength: 160 },

    // R. Validation et clôture du dossier
    coordinateurOpinion: { type: String, trim: true, maxlength: 1000 },
    responsableOpinion: { type: String, trim: true, maxlength: 1000 },
    closedAt: Date,
    closedByCoordinateur: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closedByResponsable: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const newSoulSchema = new mongoose.Schema(
  {
    caseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    status: {
      type: String,
      enum: NEW_SOUL_STATUSES,
      default: "nouveau",
      index: true,
    },
    statusHistory: { type: [statusHistoryEntrySchema], default: [] },

    soa: { type: soaSchema, default: () => ({}) },
    cana: { type: canaSchema, default: () => ({}) },

    // Posé par newSoul.service.js#close — voir le design validé :
    // la clôture crée un vrai Member (matricule, bergerie), jamais de
    // ressaisie, la personne rejoint le même annuaire que les membres
    // actuels.
    createdMemberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },

    createdBy: authorSchema,
  },
  { timestamps: true }
);

newSoulSchema.index({ "soa.lastName": 1, "soa.firstName": 1 });
newSoulSchema.index({ "createdBy.id": 1 });
newSoulSchema.index({ "cana.responsable": 1 });

export default mongoose.model("NewSoul", newSoulSchema);
