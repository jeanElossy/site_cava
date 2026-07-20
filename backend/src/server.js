import { env, validateEnv } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { createApp } from "./app.js";

// Point d'entrée.
//
// L'ordre compte : on valide la configuration AVANT de tenter quoi que
// ce soit. Démarrer puis échouer sur la première requête donnerait
// l'illusion d'un serveur en bonne santé.

const start = async () => {
  try {
    validateEnv();
  } catch (error) {
    console.error(`\n${error.message}\n`);

    process.exit(1);
  }

  try {
    await connectDB();

    console.log("Base de données connectée.");
  } catch (error) {
    console.error(
      "\nConnexion à MongoDB impossible :\n  " +
        error.message +
        "\n\nVérifiez MONGODB_URI et, sur Atlas, que votre adresse IP est autorisée.\n"
    );

    process.exit(1);
  }

  const server = createApp().listen(env.PORT, () => {
    console.log(
      `API prête sur http://localhost:${env.PORT} (${env.NODE_ENV})`
    );
  });

  // Arrêt propre : on laisse les requêtes en cours se terminer et on
  // ferme la connexion base. Sans cela, un redéploiement coupe des
  // requêtes en vol et laisse des connexions ouvertes côté Atlas.
  const shutdown = async (signal) => {
    console.log(`\n${signal} reçu, arrêt en cours…`);

    server.close(async () => {
      await disconnectDB();

      console.log("Arrêt terminé.");

      process.exit(0);
    });

    // Filet de sécurité si une requête ne se termine jamais.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Une promesse rejetée non gérée laisse le process dans un état
  // indéterminé : mieux vaut journaliser et redémarrer proprement.
  process.on("unhandledRejection", (reason) => {
    console.error("Promesse rejetée non gérée :", reason);

    shutdown("unhandledRejection");
  });
};

start();
