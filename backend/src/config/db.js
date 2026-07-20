import mongoose from "mongoose";

// Connexion MongoDB.
//
// L'URI vient exclusivement de l'environnement : aucune chaîne de
// connexion ne doit apparaître dans le code ni être commitée.
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI est absente. Renseignez-la dans le fichier .env (voir .env.example)."
    );
  }

  // Bloque les champs non déclarés au schéma : une faute de frappe
  // dans un controller lève une erreur au lieu d'écrire silencieusement
  // un champ parasite en base.
  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
};

export const disconnectDB = () => mongoose.disconnect();
