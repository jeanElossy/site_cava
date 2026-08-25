import * as socialContributionService from "../services/socialContribution.service.js";

// Génération quotidienne des lignes de cotisation sociale, pour chaque
// église dotée de `SocialFundSettings` — calque exact de
// followUpReminders.js (voir ce fichier pour la justification du
// `setInterval` plutôt qu'une dépendance de cron).
//
// Le balayage rattrape TOUS les mois dus depuis 2024, pas seulement le
// mois courant : un membre ajouté hors ligne, ou pendant une panne du
// filet de sécurité ci-dessous, récupère ainsi son historique complet
// au passage suivant. L'opération est idempotente, donc sans effet
// quand il n'y a rien à rattraper (cas de très loin le plus fréquent).
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const runSweep = async () => {
  try {
    const created =
      await socialContributionService.generateDueContributions();

    if (created > 0) {
      console.log(
        `[socialContributionsGenerator] ${created} ligne(s) générée(s).`
      );
    }
  } catch (error) {
    // Comme followUpReminders.js : un balayage manqué ne doit jamais
    // faire planter le serveur, seulement se journaliser.
    console.error(
      "[socialContributionsGenerator] balayage impossible :",
      error.message
    );
  }
};

// Appelée une fois au démarrage du serveur (voir server.js) — jamais
// dans les tests, qui passent par `createApp()` directement sans
// jamais exécuter `server.js`.
export const scheduleSocialContributionsGenerator = () => {
  runSweep();

  const timer = setInterval(runSweep, SWEEP_INTERVAL_MS);

  timer.unref();
};
