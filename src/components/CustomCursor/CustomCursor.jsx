import { useEffect, useRef } from "react";

import "./CustomCursor.scss";

// Curseur personnalisé : un POINT qui colle à la souris, et un CERCLE
// qui le rattrape. Quand la souris s'arrête, le cercle finit sa course
// et le point se retrouve en son centre.
//
// ------------------------------------------------------------------
// AUCUN ÉTAT REACT
// ------------------------------------------------------------------
// La position ne passe PAS par `useState` : `mousemove` se déclenche
// des dizaines de fois par seconde, et un rendu React à chaque
// mouvement re-rendrait toute la page sous le curseur. Les positions
// vivent dans des `ref`, et seul `transform` est écrit, dans une
// boucle `requestAnimationFrame` — la seule propriété que le
// navigateur sait animer sans recalculer la mise en page.
//
// ------------------------------------------------------------------
// CE COMPOSANT NE S'AFFICHE PAS TOUJOURS, ET C'EST VOULU
// ------------------------------------------------------------------
// Sur un écran tactile il n'y a pas de souris à remplacer : masquer le
// curseur natif n'y aurait aucun sens, et la boucle d'animation
// tournerait pour rien sur la batterie d'un téléphone. `(pointer:
// fine)` écarte ces appareils, et le SCSS ne masque le curseur natif
// que sous la même condition — les deux doivent rester d'accord, sans
// quoi on obtiendrait un écran sans curseur du tout.

// Vitesse de rattrapage du cercle, entre 0 et 1. Plus la valeur est
// basse, plus le cercle traîne. 0,18 laisse voir la traîne sans donner
// l'impression d'un curseur qui décroche.
const EASE = 0.18;

// Éléments sur lesquels le cercle grossit. Masquer le curseur natif
// supprime la petite main des liens et la barre de saisie des champs :
// sans ce repli, l'interface perdrait l'indication « ceci se clique »,
// que rien d'autre ne porte.
const INTERACTIVE =
  "a, button, input, select, textarea, label, [role='button']";

// Champs de SAISIE, traités à part des autres éléments interactifs.
//
// Masquer le curseur natif supprime la barre verticale qui indique où
// le texte va s'insérer, et cette barre n'a pas d'équivalent : le
// cercle dit « ceci se clique », il ne dit pas « ceci s'écrit », et il
// ne montre pas non plus la position exacte du point d'insertion dans
// un mot. Sur les formulaires du back-office — saisie de membres,
// d'offrandes, de dossiers — la perte est réelle.
//
// Sur ces champs-là, donc : curseur natif rendu, curseur personnalisé
// masqué. Les deux à la fois donneraient un doublon.
//
// `[type]` absent vaut `text` en HTML, d'où `input:not([type])`. Les
// cases à cocher, boutons radio et sélecteurs de fichier ne sont PAS
// dans cette liste : ils se cliquent, ils ne se saisissent pas.
const TEXT_FIELDS = [
  "textarea",
  "input:not([type])",
  "input[type='text']",
  "input[type='email']",
  "input[type='tel']",
  "input[type='password']",
  "input[type='search']",
  "input[type='url']",
  "input[type='number']",
  "input[type='date']",
  "[contenteditable='true']",
].join(", ");

const CustomCursor = () => {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    // Ni souris, ni animation souhaitée : on ne monte rien. La
    // préférence « réduire les animations » est lue ICI plutôt que
    // dans le SCSS, parce qu'elle doit aussi empêcher la boucle
    // d'animation de tourner, pas seulement la masquer.
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    if (!finePointer.matches || reducedMotion.matches) return undefined;

    const dot = dotRef.current;
    const ring = ringRef.current;

    if (!dot || !ring) return undefined;

    // Position réelle de la souris, et position courante du cercle.
    // Le cercle démarre au même endroit que le point : sans cela, il
    // traverserait l'écran depuis le coin supérieur gauche au premier
    // mouvement.
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ringPos = { ...mouse };

    let frame = 0;
    let visible = false;

    const show = () => {
      if (visible) return;

      visible = true;
      document.body.classList.add("has-custom-cursor--visible");
    };

    const handleMove = (event) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;

      show();
    };

    // Le curseur quitte la fenêtre : on masque, sinon le point resterait
    // figé sur le bord pendant que l'utilisateur est ailleurs.
    const handleLeave = () => {
      visible = false;
      document.body.classList.remove("has-custom-cursor--visible");
    };

    const handleOver = (event) => {
      // `closest` et non une comparaison de balise : le survol atterrit
      // souvent sur le `<svg>` ou le `<span>` À L'INTÉRIEUR d'un
      // bouton, et c'est le bouton qui porte l'affordance.
      const target = event.target;
      const interactive = target.closest?.(INTERACTIVE);

      // Un champ de saisie reprend son curseur natif — voir
      // TEXT_FIELDS. `matches` et non `closest` : c'est le champ
      // lui-même qui se saisit, pas le bloc qui l'entoure.
      const isTextField = Boolean(target.matches?.(TEXT_FIELDS));

      document.body.classList.toggle(
        "has-custom-cursor--text",
        isTextField
      );

      ring.classList.toggle(
        "custom-cursor__ring--active",
        Boolean(interactive) && !isTextField
      );
    };

    const tick = () => {
      // Le point colle à la souris, sans interpolation : c'est lui qui
      // donne la précision du pointage.
      dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0) translate(-50%, -50%)`;

      // Le cercle avance d'une fraction de la distance restante à
      // chaque image. La distance tend vers zéro sans jamais l'atteindre
      // tout à fait — d'où l'arrondi implicite du rendu : au repos, le
      // cercle se centre bien sur le point.
      ringPos.x += (mouse.x - ringPos.x) * EASE;
      ringPos.y += (mouse.y - ringPos.y) * EASE;

      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) translate(-50%, -50%)`;

      frame = window.requestAnimationFrame(tick);
    };

    document.body.classList.add("has-custom-cursor");

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("mouseover", handleOver, { passive: true });
    document.addEventListener("mouseleave", handleLeave);

    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseover", handleOver);
      document.removeEventListener("mouseleave", handleLeave);

      // Le curseur natif doit revenir si le composant est démonté :
      // sans ce nettoyage, une page sans curseur du tout.
      document.body.classList.remove("has-custom-cursor");
      document.body.classList.remove("has-custom-cursor--visible");
      document.body.classList.remove("has-custom-cursor--text");
    };
  }, []);

  return (
    // `aria-hidden` : c'est une décoration. Un lecteur d'écran n'a rien
    // à annoncer ici, et ces deux éléments ne doivent pas entrer dans
    // l'ordre de lecture.
    <div className="custom-cursor" aria-hidden="true">
      <span className="custom-cursor__ring" ref={ringRef} />
      <span className="custom-cursor__dot" ref={dotRef} />
    </div>
  );
};

export default CustomCursor;
