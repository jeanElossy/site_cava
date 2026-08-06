export const STATUS_LABELS = {
  nouveau: "Nouveau",
  enregistre_soa: "Enregistré par le SOA",
  attente_cana: "En attente CANA",
  premier_contact: "Premier contact",
  entretien_planifie: "Entretien planifié",
  en_accompagnement: "En accompagnement",
  orientation_specialisee: "Orientation spécialisée",
  formation_en_cours: "Formation en cours",
  integration_bergerie: "Intégration bergerie",
  cloture: "Clôturé",
};

// Même liste que SOA_EDITABLE_STATUSES côté serveur (NewSoul.js) —
// utilisée pour ne proposer, dans les filtres, que les statuts que le
// rôle courant a le droit d'interroger (voir NewSoulsListPage.jsx),
// plutôt que de laisser l'API renvoyer un refus après coup.
export const SOA_EDITABLE_STATUSES = ["nouveau", "enregistre_soa"];

export const STATUS_TONES = {
  nouveau: "neutral",
  enregistre_soa: "neutral",
  attente_cana: "warning",
  premier_contact: "info",
  entretien_planifie: "info",
  en_accompagnement: "info",
  orientation_specialisee: "info",
  formation_en_cours: "info",
  integration_bergerie: "success",
  cloture: "success",
};
