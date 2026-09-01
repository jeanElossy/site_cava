// Niveaux d'affectation d'un moniteur — MIROIR de
// `MONITOR_LEVELS` dans backend/src/models/MonitorAssignment.js.
//
// Le dépôt n'a pas de code partagé entre le site et l'API (voir
// CLAUDE.md) : cette liste doit donc être tenue en accord à la main, et
// `monitorLevels.test.js` compare les deux fichiers pour que l'oubli se
// voie tout de suite.
//
// Sans ce miroir, le formulaire d'affectation proposait « Moniteur »,
// « Assistant », « Responsable de classe » — trois valeurs qu'aucun
// schéma n'accepte, et l'enregistrement échouait sur un message qui ne
// désignait aucun champ.
export const MONITOR_LEVELS = ["principal", "secondaire"];

export const MONITOR_LEVEL_LABELS = {
  principal: "Moniteur principal",
  secondaire: "Moniteur secondaire",
};

export const monitorLevelLabel = (level) =>
  MONITOR_LEVEL_LABELS[level] ?? MONITOR_LEVEL_LABELS.principal;
