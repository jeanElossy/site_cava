import stored from "./testimonials.json";

// Témoignages, récupérés en base au moment du build.
//
// ------------------------------------------------------------------
// PLUS AUCUN TÉMOIGNAGE N'EST ÉCRIT DANS LE CODE
// ------------------------------------------------------------------
// Les deux pages en portaient chacune trois, inventés : des paroles
// attribuées nommément à des membres qui ne les avaient jamais dites.
// Ils sont désormais saisis depuis l'administration, par ceux qui les
// ont réellement recueillis, avec l'accord de la personne enregistré.
//
// Tant qu'aucun n'est saisi, les sections concernées se masquent
// d'elles-mêmes. Une page de don sans témoignage vaut mieux qu'une
// page de don avec des témoignages faux.

const list = (value) => (Array.isArray(value) ? value : []);

export const donTestimonials = list(stored.don);

export const communityTestimonials = list(stored.communaute);

export default { don: donTestimonials, communaute: communityTestimonials };
