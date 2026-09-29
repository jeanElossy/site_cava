import {
  FaGraduationCap,
  FaPrayingHands,
  FaHandHoldingHeart,
  FaHands,
  FaCoins,
  FaFileSignature,
  FaBullhorn,
  FaHandsHelping,
} from "react-icons/fa";

// L'icône d'un poste est un choix d'HABILLAGE, pas une donnée : le
// modèle ne stocke qu'une clé, la correspondance vit ici — même
// séparation que `MinistriesGrid`, qui garde ses icônes hors du modèle.
//
// Les clés doivent rester alignées sur l'énumération `icon` de
// backend/src/models/Position.js. Une clé inconnue ne provoque aucune
// erreur : `iconFor` retombe sur une icône neutre plutôt que de rendre
// une carte vide.
const ICONS = {
  graduation: FaGraduationCap,
  prayer: FaPrayingHands,
  flock: FaHandHoldingHeart,
  worship: FaHands,
  finance: FaCoins,
  secretariat: FaFileSignature,
  media: FaBullhorn,
  social: FaHandsHelping,
};

export const iconFor = (key) => ICONS[key] ?? FaHands;

// Même remarque pour la variante de couleur : un nom absent du SCSS
// laisserait la carte sans fond, donc son icône blanche invisible.
export const VARIANTS = ["light", "gold", "dark"];

export const variantFor = (value) =>
  VARIANTS.includes(value) ? value : "light";
