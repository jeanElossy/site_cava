// Libellés des statuts d'un message (enum du modèle Message côté API),
// partagés par la boîte de réception et le tableau de bord : afficher
// la valeur brute donnait « REPONDU », sans accent.
export const MESSAGE_STATUS_LABELS = {
  nouveau: "Nouveau",
  lu: "Lu",
  repondu: "Répondu",
  archive: "Archivé",
};

export const messageStatusLabel = (status) =>
  MESSAGE_STATUS_LABELS[status] ?? MESSAGE_STATUS_LABELS.nouveau;
