// Options des champs à choix (radio/checkbox) du formulaire SOA,
// reprises mot pour mot de la fiche officielle papier CANA (§A à §G).

export const CATEGORY_OPTIONS = [
  { value: "enfant", label: "Enfant" },
  { value: "adolescent", label: "Adolescent(e)" },
  { value: "adulte", label: "Adulte" },
];

export const CONTACT_METHOD_OPTIONS = [
  { value: "appel", label: "Appel téléphonique" },
  { value: "appel_whatsapp", label: "Appel WhatsApp" },
  { value: "message_whatsapp", label: "Message WhatsApp" },
  { value: "sms", label: "SMS" },
];

export const ORIGIN_OPTIONS = [
  { value: "evangelisation", label: "Action d'évangélisation" },
  { value: "invitation", label: "Invitation d'un membre" },
  { value: "culte_spontane", label: "Participation spontanée à un culte" },
  { value: "campagne", label: "Campagne ou programme spécial" },
  { value: "reseaux_sociaux", label: "Réseaux sociaux" },
  { value: "recommandation", label: "Recommandation" },
  { value: "demande_personnelle", label: "Demande personnelle" },
  { value: "autre", label: "Autre", hasOther: true },
];

export const FIRST_VISIT_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "non_precise", label: "Information non précisée" },
];

export const DECISION_OPTIONS = [
  { value: "accepte_recemment", label: "Avoir accepté Jésus-Christ récemment" },
  { value: "deja_accepte", label: "Avoir déjà accepté Jésus-Christ" },
  { value: "desire_accepter", label: "Désirer accepter Jésus-Christ" },
  { value: "revient_a_dieu", label: "Revenir à Dieu après une période d'éloignement" },
  { value: "recherche_eglise", label: "Rechercher une Église locale" },
  { value: "veut_connaitre_foi", label: "Désirer mieux connaître la foi chrétienne" },
  { value: "ne_sait_pas", label: "Ne pas savoir clairement où elle en est" },
  { value: "autre", label: "Autre", hasOther: true },
];

export const WATER_BAPTISM_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "a_verifier", label: "Information à vérifier" },
];

export const CURRENT_CHURCH_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "occasionnellement", label: "Occasionnellement" },
  { value: "a_preciser", label: "Situation à préciser" },
];

export const NEEDS_OPTIONS = [
  { value: "comprendre_salut", label: "Comprendre le salut" },
  { value: "apprendre_prier", label: "Apprendre à prier" },
  { value: "lire_bible", label: "Apprendre à lire et méditer la Bible" },
  { value: "fondements", label: "Recevoir les enseignements fondamentaux" },
  { value: "accompagnement", label: "Être accompagné(e) dans sa nouvelle vie chrétienne" },
  { value: "ecoute_pastorale", label: "Recevoir une écoute pastorale" },
  { value: "soutien_social", label: "Recevoir un soutien ou une orientation sociale" },
  { value: "priere", label: "Recevoir la prière" },
  { value: "visite", label: "Recevoir une visite" },
  { value: "preparation_bapteme", label: "Se préparer au baptême" },
  { value: "decouvrir_cava", label: "Obtenir des informations sur ÇA.VA." },
  { value: "autre", label: "Autre besoin", hasOther: true },
];

export const CONSENT_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "a_confirmer", label: "À confirmer" },
];

export const COMPLETENESS_OPTIONS = [
  { value: "complet", label: "Complet : les informations essentielles sont renseignées." },
  { value: "a_completer", label: "À compléter : certaines informations essentielles manquent." },
];
