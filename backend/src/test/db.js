import mongoose from "mongoose";
import "dotenv/config";

// Petit utilitaire partagé par les tests d'intégration (ceux qui
// touchent MongoDB). Chaque fichier de test `node --test` s'exécute
// dans son propre processus : une connexion par fichier ne pose pas
// de conflit.
//
// Utilise la même base que le développement (MONGODB_URI) : ce projet
// n'a pas de base de test dédiée. Les tests qui l'utilisent doivent
// nettoyer scrupuleusement ce qu'ils créent (identifiants de test
// improbables en production, ex. église fictive `church: 9`).
export const connectTestDb = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI est absente : impossible d'exécuter les tests d'intégration MongoDB."
    );
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
};

export const disconnectTestDb = async () => {
  await mongoose.disconnect();
};
