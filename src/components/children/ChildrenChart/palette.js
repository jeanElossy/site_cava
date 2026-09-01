// Couleurs des graphiques du module Enfants.
//
// ------------------------------------------------------------------
// LES COULEURS DE L'ÉGLISE : VERT, BLANC, JAUNE
// ------------------------------------------------------------------
// Chacune garde ici le rôle qu'elle a déjà partout sur le site :
//
//   BLANC  les surfaces (cartes, fonds) — `$admin-surface`
//   VERT   les données ($primary #0d5b3e et ses étapes plus claires)
//   JAUNE  la mise en avant ($secondary) — un seuil, une alerte, la
//          valeur du jour. JAMAIS une série parmi d'autres : une
//          couleur d'accent qui sert aussi de série ne peut plus rien
//          signaler.
//
// ------------------------------------------------------------------
// POURQUOI UNE RAMPE, ET NON QUATRE TEINTES
// ------------------------------------------------------------------
// Les classes ne sont pas des catégories quelconques : elles sont
// ORDONNÉES PAR ÂGE (03-05, 06-08, 09-12). Une progression du vert
// clair au vert profond dit donc quelque chose de vrai — les petits
// d'un côté, les grands de l'autre — là où quatre teintes sans rapport
// ne diraient rien du tout.
//
// C'est aussi ce qui permet de tenir la consigne : deux couleurs de
// marque ne peuvent pas fournir quatre teintes catégorielles
// distinctes, mais une seule suffit à bâtir une rampe.
//
// ------------------------------------------------------------------
// VALIDÉE, PAS CHOISIE À L'ŒIL
// ------------------------------------------------------------------
// Les quatre étapes passent les contrôles d'une rampe ordonnée —
// clarté strictement croissante, écart d'au moins 0,06 entre étapes
// voisines, teinte unique (1° d'écart), extrémité claire détachée de
// la surface — en thème CLAIR comme en thème SOMBRE.
//
// La dernière étape EST le vert CAVA (`$primary`).
export const RAMP = ["#5cc79a", "#22a173", "#157a56", "#0d5b3e"];

// Jaune de l'église, réservé à la MISE EN AVANT. Exposé ici pour que
// les graphiques n'aillent pas en chercher une autre nuance.
export const HIGHLIGHT = "#f4c41d";

// ORDRE FIXE, JAMAIS CYCLIQUE.
//
// La couleur suit l'ENTITÉ, pas son rang à l'écran : filtrer une
// classe ne doit pas repeindre les autres. L'index vient donc de la
// position de la classe dans la liste complète — ordonnée par âge —
// jamais de sa position dans le graphique affiché.
//
// Au-delà de quatre classes, la cinquième n'invente pas une étape :
// elle prend le gris de repli et rejoint « Autres ». Prolonger la
// rampe produirait deux verts indiscernables, ce que les contrôles
// ci-dessus servent précisément à empêcher.
export const colorFor = (index) =>
  index >= 0 && index < RAMP.length
    ? RAMP[index]
    : "var(--admin-ink-faint, #8c9a94)";

export const MAX_SERIES = RAMP.length;
