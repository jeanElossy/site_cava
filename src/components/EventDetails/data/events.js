// Adaptateur — les données viennent désormais de la BASE.
//
// Ce module ne contient plus de contenu écrit en dur. Il lit
// `src/content/events.json`, généré au moment du build par
// `scripts/fetch-content.mjs`, qui interroge l'API.
//
// Son interface est INCHANGÉE (`eventsList` et l'export par défaut
// indexé par slug) : aucun composant consommateur n'a été modifié.
//
// Les images ne sont plus importées depuis `src/assets` mais
// référencées par chemin absolu depuis `public/` : c'est la base qui
// porte désormais le chemin, et elle ne peut pas produire d'import
// JavaScript.
//
// Pour rafraîchir le contenu : publier depuis l'administration, ce qui
// déclenche une reconstruction du site.

import events from "../../../content/events.json";

// Ordre d'affichage (chronologique), utilisé par l'accueil et /events.
export const eventsList = Object.values(events);

export default events;
