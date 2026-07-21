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
// POURQUOI CERTAINS CHIFFRES SONT ÉCARTÉS
// ------------------------------------------------------------------
// Ces chiffres reflètent ce qui est RÉELLEMENT saisi dans le registre,
// et le registre se remplit progressivement. Or un chiffre trop bas
// n'est pas seulement modeste : il est FAUX vis-à-vis de la réalité de
// l'assemblée, et il dessert l'église plus qu'un silence.
//
// « 1 membre » sur une page intitulée « notre communauté » donnerait
// l'image d'une église déserte alors qu'elle ne fait que commencer sa
// saisie. Chaque rubrique a donc un seuil en dessous duquel elle
// disparaît, et la section entière disparaît s'il ne reste aucune
// carte.
//
// Ces seuils ne sont pas des minimums arbitraires à contourner : le
// jour où le registre est à jour, ils ne se voient plus.

const count = (value, floor) =>
  Number.isFinite(value) && value >= floor ? value : 0;

export const communityStats = {
  // Un effectif crédible pour une assemblée : en dessous, la saisie
  // est manifestement en cours.
  members: count(stored.members, 20),

  servants: count(stored.servants, 5),

  // Deux quartiers suffisent à parler de plusieurs communes ; un seul
  // ne dit rien.
  districts: count(stored.districts, 2),

  // Les ministères, eux, sont réellement tous saisis : ils viennent du
  // contenu du site, pas d'un registre en cours de constitution.
  ministries: count(stored.ministries, 1),
};

export default communityStats;
