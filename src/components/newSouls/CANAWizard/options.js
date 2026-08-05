// Options des champs à choix du formulaire CANA, reprises de la fiche
// officielle papier (§H à §R).

export const REVIEW_OPTIONS = [
  { value: "dossier_exploitable", label: "Dossier exploitable" },
  { value: "info_complementaires_demandees", label: "Informations complémentaires demandées au SOA" },
  { value: "coordonnees_a_verifier", label: "Coordonnées à vérifier" },
  { value: "accord_a_confirmer", label: "Accord de contact à confirmer" },
];

export const CONTACT_METHOD_OPTIONS = [
  { value: "appel", label: "Appel téléphonique" },
  { value: "appel_whatsapp", label: "Appel WhatsApp" },
  { value: "message_whatsapp", label: "Message WhatsApp" },
  { value: "sms", label: "SMS" },
];

export const FIRST_CONTACT_RESULT_OPTIONS = [
  { value: "contact_etabli", label: "Contact établi" },
  { value: "disposee_accompagnement", label: "Personne disposée à être accompagnée" },
  { value: "entretien_accepte", label: "Entretien accepté" },
  { value: "entretien_a_confirmer", label: "Entretien à confirmer" },
  { value: "a_rappeler", label: "Personne à rappeler" },
  { value: "injoignable", label: "Personne temporairement injoignable" },
  { value: "coordonnees_incorrectes", label: "Coordonnées incorrectes" },
  { value: "refus", label: "Refus de l'accompagnement" },
];

export const INTERVIEW_MODE_OPTIONS = [
  { value: "eglise", label: "En présentiel à l'Église" },
  { value: "autre_lieu", label: "En présentiel dans un autre lieu convenu" },
  { value: "domicile", label: "Au domicile de la personne" },
  { value: "appel", label: "Par appel téléphonique" },
  { value: "appel_video", label: "Par appel vidéo" },
  { value: "autre", label: "Autre", hasOther: true },
];

export const MARITAL_STATUS_OPTIONS = [
  { value: "celibataire", label: "Célibataire" },
  { value: "fiance", label: "Fiancé(e)" },
  { value: "marie", label: "Marié(e)" },
  { value: "veuf", label: "Veuf ou veuve" },
  { value: "separe", label: "Séparé(e)" },
  { value: "autre", label: "Autre", hasOther: true },
  { value: "non_precise", label: "Ne souhaite pas préciser" },
];

export const CURRENT_SITUATION_OPTIONS = [
  { value: "en_activite", label: "En activité" },
  { value: "recherche_emploi", label: "En recherche d'emploi" },
  { value: "etudiant", label: "Élève ou étudiant(e)" },
  { value: "retraite", label: "Retraité(e)" },
  { value: "autre", label: "Autre", hasOther: true },
];

export const UNDERSTANDS_SALVATION_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "partiellement", label: "Partiellement" },
  { value: "non", label: "Non" },
  { value: "a_approfondir", label: "À approfondir" },
];

export const FREQUENCY_OPTIONS = [
  { value: "regulierement", label: "Régulièrement" },
  { value: "occasionnellement", label: "Occasionnellement" },
  { value: "pas_encore", label: "Pas encore" },
];

export const READS_BIBLE_OPTIONS = [
  ...FREQUENCY_OPTIONS,
  { value: "sans_bible", label: "Ne possède pas de Bible" },
];

export const RECEIVED_FOUNDATIONS_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "partiellement", label: "Partiellement" },
  { value: "non", label: "Non" },
  { value: "ne_sait_pas", label: "Elle ne sait pas" },
];

export const SITUATION_CLARIFIED_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "non_applicable", label: "Non applicable" },
  { value: "necessite_accompagnement", label: "Nécessite un accompagnement pastoral" },
];

export const PRAYER_TRANSMISSION_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "forme_generale", label: "Seulement sous une forme générale" },
];

export const PRAYER_CONFIDENTIALITY_OPTIONS = [
  { value: "avec_nom", label: "Sujet pouvant être communiqué avec le nom" },
  { value: "sans_nom", label: "Sujet à transmettre sans mentionner le nom" },
  { value: "responsables_autorises", label: "Sujet réservé aux responsables autorisés" },
];

export const PRAYER_FOLLOW_UP_OPTIONS = [
  { value: "ponctuelle", label: "Prière ponctuelle" },
  { value: "reguliere", label: "Prière régulière" },
  { value: "a_reevaluer", label: "Situation à réévaluer" },
];

export const DELIVERANCE_NEEDED_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "discernement_pastoral", label: "À soumettre au discernement pastoral" },
];

export const DELIVERANCE_ACCEPTED_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "veut_explications", label: "Elle souhaite recevoir davantage d'explications" },
];

export const PASTORAL_MEETING_NEEDED_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "a_evaluer", label: "À évaluer" },
];

export const PASTORAL_MEETING_REASON_OPTIONS = [
  { value: "conseil_pastoral", label: "Besoin de conseil pastoral" },
  { value: "situation_familiale", label: "Situation familiale" },
  { value: "situation_ecclesiale", label: "Situation ecclésiale antérieure" },
  { value: "question_doctrinale", label: "Question doctrinale" },
  { value: "besoin_ecoute", label: "Besoin d'écoute" },
  { value: "decision_spirituelle", label: "Décision spirituelle importante" },
  { value: "autre", label: "Autre", hasOther: true },
];

export const PASTORAL_MEETING_PRIORITY_OPTIONS = [
  { value: "normale", label: "Normale" },
  { value: "prioritaire", label: "Prioritaire" },
  { value: "ulterieure", label: "À programmer ultérieurement" },
];

export const SOCIAL_NEED_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "a_approfondir", label: "À approfondir" },
];

export const SOCIAL_NEED_AREAS_OPTIONS = [
  { value: "alimentation", label: "Alimentation" },
  { value: "logement", label: "Logement" },
  { value: "sante", label: "Santé" },
  { value: "travail", label: "Travail ou activité" },
  { value: "scolarite", label: "Scolarité ou formation" },
  { value: "situation_familiale", label: "Situation familiale" },
  { value: "orientation_administrative", label: "Orientation administrative" },
  { value: "autre", label: "Autre", hasOther: true },
];

export const TRAINING_NEEDED_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "a_evaluer", label: "À évaluer" },
];

export const TRAINING_DIFFICULTY_OPTIONS = [
  { value: "aucune", label: "Aucune difficulté signalée" },
  { value: "accompagnement_adapte", label: "Besoin d'un accompagnement adapté" },
  { value: "a_verifier", label: "À vérifier" },
];

export const HAS_TRANSPORT_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "occasionnellement", label: "Occasionnellement" },
];

export const FACES_OBSTACLES_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "a_preciser", label: "À préciser" },
];

export const VISIT_POSSIBLE_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "ulterieurement", label: "À proposer ultérieurement" },
];

export const ORIENTATIONS_OPTIONS = [
  { value: "intercession", label: "Transmission du sujet au ministère d'intercession" },
  { value: "suivi_priere", label: "Suivi régulier du sujet de prière" },
  { value: "entretien_delivrance", label: "Entretien avec le ministère de délivrance" },
  { value: "seance_delivrance", label: "Séance de délivrance à programmer" },
  { value: "rencontre_pasteur", label: "Rencontre avec le pasteur" },
  { value: "commission_sociale", label: "Orientation vers la Commission sociale" },
  { value: "ifip_vie", label: "Orientation vers l'IFIP. VIE" },
  { value: "appels_reguliers", label: "Appels réguliers" },
  { value: "messages_encouragement", label: "Messages d'encouragement" },
  { value: "visite", label: "Visite à programmer" },
  { value: "accompagnement_priere_lecture", label: "Accompagnement dans la prière et la lecture biblique" },
  { value: "preparation_bergerie", label: "Préparation progressive à l'intégration en bergerie" },
  { value: "aucune", label: "Aucune orientation spécialisée pour le moment" },
  { value: "autre", label: "Autre", hasOther: true },
];

export const CHECKPOINTS_OPTIONS = [
  { value: "contacts_reguliers", label: "Contacts réguliers" },
  { value: "participation_cultes", label: "Participation aux cultes" },
  { value: "participation_formation", label: "Participation à la formation recommandée" },
  { value: "orientations_realisees", label: "Orientations spécialisées réalisées" },
  { value: "evolution_besoins", label: "Évolution des besoins" },
  { value: "visite_realisee", label: "Visite réalisée ou à programmer" },
  { value: "progression_spirituelle", label: "Progression spirituelle observée" },
  { value: "preparation_bergerie", label: "Préparation à l'intégration en bergerie" },
  { value: "vigilance_particuliere", label: "Vigilance particulière nécessaire" },
];

export const FINAL_SITUATION_OPTIONS = [
  { value: "suivie_regulierement", label: "Personne régulièrement suivie" },
  { value: "fondements_en_cours", label: "Fondements spirituels en cours d'acquisition" },
  { value: "participation_reguliere", label: "Participation régulière aux activités" },
  { value: "formation_en_cours_ou_achevee", label: "Formation commencée ou achevée" },
  { value: "besoins_specialises_pris_en_charge", label: "Besoins spécialisés pris en charge" },
  { value: "prete_integration", label: "Prête pour l'intégration en bergerie" },
  { value: "prolongement_exceptionnel", label: "Accompagnement à prolonger exceptionnellement" },
  { value: "orientation_pastorale_necessaire", label: "Orientation pastorale encore nécessaire" },
  { value: "parcours_interrompu", label: "Parcours interrompu" },
  { value: "ne_souhaite_plus_poursuivre", label: "Personne ne souhaitant plus poursuivre" },
];

export const INTEGRATION_CONFIRMED_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "en_attente", label: "En attente de vérification" },
];

export const MONTHLY_PERIODS = [
  { value: "mois_1", label: "Mois 1", defaultObjective: "Accueil, entretien et diagnostic" },
  { value: "mois_2", label: "Mois 2", defaultObjective: "Mise en œuvre des orientations" },
  { value: "mois_3", label: "Mois 3", defaultObjective: "Suivi et préparation à l'intégration" },
  { value: "mois_4", label: "Mois 4", defaultObjective: "Bilan final et intégration" },
];
