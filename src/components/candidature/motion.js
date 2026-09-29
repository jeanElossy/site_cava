import { useReducedMotion } from "framer-motion";

// Mouvement de la page Appel à candidatures, défini À UN SEUL ENDROIT.
//
// Les mêmes quatre props (`initial`, `whileInView`, `viewport`,
// `transition`) se répétaient sur chaque carte des sections existantes
// du site ; recopiées sur les sept sections de cette page, la moindre
// retouche de rythme aurait demandé de les retrouver une par une.
//
// ACCESSIBILITÉ : `useReducedMotion()` lit la préférence système
// « réduire les animations ». Quand elle est active, on ne renvoie
// AUCUNE prop d'animation : l'élément est rendu à sa place définitive,
// il n'apparaît pas puis ne bouge plus. Sans cela, quelqu'un qui a
// demandé moins de mouvement — parce que les animations lui donnent le
// vertige — verrait quand même défiler toute la page.
//
// Courbe `[0.22, 1, 0.36, 1]` (ease-out marquée) : l'élément arrive
// vite puis se pose, plutôt que de flotter. C'est ce qui distingue une
// apparition d'un fondu paresseux.
const EASE = [0.22, 1, 0.36, 1];

export const useReveal = () => {
  const reduced = useReducedMotion();

  // `index` échelonne les enfants d'une même grille ; `axis` choisit
  // l'entrée par le bas (défaut) ou par la gauche.
  //
  // `amount` : la fraction de l'élément qui doit être visible pour
  // déclencher. 0.2 convient à une carte, mais PAS à un bloc plus haut
  // que la fenêtre — le formulaire fait près de 1900 px, et exiger 20 %
  // de sa hauteur le laissait transparent jusqu'à ce qu'on en ait déjà
  // dépassé le titre. Pour ces blocs-là, `"some"` (le moindre pixel
  // visible) est le bon seuil.
  return (index = 0, axis = "y", amount = 0.2) => {
    if (reduced) return {};

    const offset = axis === "x" ? { x: -28 } : { y: 26 };

    return {
      initial: { opacity: 0, ...offset },
      whileInView: { opacity: 1, x: 0, y: 0 },
      // `once` : l'apparition ne se rejoue pas à chaque aller-retour de
      // défilement, ce qui donnerait un clignotement permanent.
      viewport: { once: true, amount },
      transition: {
        duration: 0.55,
        delay: Math.min(index, 8) * 0.07,
        ease: EASE,
      },
    };
  };
};

// Survol des cartes : léger soulèvement. Séparé de `useReveal` parce
// qu'il n'a rien à voir avec le défilement — et parce qu'il doit lui
// aussi disparaître en mouvement réduit.
export const useHoverLift = () => {
  const reduced = useReducedMotion();

  if (reduced) return {};

  return {
    whileHover: { y: -6 },
    whileTap: { y: -2 },
    transition: { duration: 0.25, ease: EASE },
  };
};
