import * as newSoulService from "../services/newSoul.service.js";

// Aucune infrastructure de tâches planifiées (cron) n'existait dans ce
// projet avant les rappels de suivi mensuel — plutôt que d'introduire
// une dépendance pour un unique job quotidien, un `setInterval` de 24h
// suffit : le process reste actif en continu (voir server.js), pas de
// fonction serverless ici.
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const runSweep = async () => {
  try {
    const sent = await newSoulService.sendUpcomingFollowUpReminders();

    if (sent > 0) {
      console.log(`[followUpReminders] ${sent} rappel(s) de suivi mensuel envoyé(s).`);
    }
  } catch (error) {
    // Comme push.service.js : un rappel manqué ne doit jamais faire
    // planter le serveur, seulement se journaliser.
    console.error("[followUpReminders] balayage impossible :", error.message);
  }
};

// Appelée une fois au démarrage du serveur (voir server.js) — jamais
// dans les tests, qui passent par `createApp()` directement sans
// jamais exécuter `server.js`.
export const scheduleFollowUpReminders = () => {
  runSweep();

  const timer = setInterval(runSweep, SWEEP_INTERVAL_MS);

  // `unref()` : ce minuteur ne doit jamais, à lui seul, empêcher le
  // process de s'arrêter proprement (voir le arrêt propre de
  // server.js).
  timer.unref();
};
