import stored from "./community.json";

// Statistiques de la communauté, comptées en base au moment du build.
//
// ------------------------------------------------------------------
// CE QUI EST PUBLIÉ, ET CE QUI NE L'EST PAS
// ------------------------------------------------------------------
// Les fiches de membres ne sortent JAMAIS de l'administration : ce sont
// des données personnelles (nom, téléphone, quartier), et le service
// correspondant les rend délibérément inaccessibles publiquement.
//
// Seuls des COMPTEURS sont exposés. Un total ne permet d'identifier
// personne, alors qu'il donne au visiteur une idée juste de la vie de
// l'église — bien plus qu'un chiffre inventé une fois et jamais mis à
// jour.
//
// ------------------------------------------------------------------
// POURQUOI LES ZÉROS SONT ÉCARTÉS
// ------------------------------------------------------------------
// Ces chiffres reflètent ce qui est RÉELLEMENT saisi dans le registre.
// Tant qu'une rubrique est vide, afficher « 0 membre » serait pire que
// de ne rien afficher. Une carte à zéro disparaît donc, et la section
// entière disparaît s'il n'en reste aucune.

const count = (value) =>
  Number.isFinite(value) && value > 0 ? value : 0;

export const communityStats = {
  members: count(stored.members),
  servants: count(stored.servants),
  districts: count(stored.districts),
  ministries: count(stored.ministries),
};

export default communityStats;
