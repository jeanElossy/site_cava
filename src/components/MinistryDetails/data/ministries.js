// Adaptateur — les données viennent désormais de la BASE.
//
// Ce module ne contient plus de contenu écrit en dur. Il lit
// `src/content/ministries.json`, généré au moment du build par
// `scripts/fetch-content.mjs`, qui interroge l'API.
//
// Interface INCHANGÉE : un objet indexé par slug, exporté par défaut.
// `MinistryDetails.jsx` continue de faire `ministries[slug]` et
// d'afficher son repli « Ministère introuvable » si la clé n'existe
// pas.
//
// Toutes les images (héros comme galerie) sont désormais des chemins
// absolus vers `public/` : elles proviennent de la base, qui ne peut
// pas produire d'import JavaScript traité par Vite.

import ministries from "../../../content/ministries.json";

export default ministries;
