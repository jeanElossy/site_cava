import {
  FaBookOpen,
  FaChild,
  FaChurch,
  FaDove,
  FaFemale,
  FaGlobeAfrica,
  FaHeart,
  FaHandsHelping,
  FaHome,
  FaMusic,
  FaPrayingHands,
  FaUsers,
} from "react-icons/fa";

// Icône d'un ministère, choisie par SLUG et non par position : les
// ministères sont administrables, et une icône attribuée par rang
// changeait de sens dès qu'on en ajoutait ou réordonnait un. Le modèle
// ne stocke pas d'icône — c'est un choix d'habillage, pas une donnée.
const ICONS_BY_SLUG = {
  intercession: FaPrayingHands,
  formation: FaBookOpen,
  jeunesse: FaUsers,
  enfance: FaChild,
  evangelisation: FaGlobeAfrica,
  "louange-adoration": FaMusic,
  "action-sociale": FaHandsHelping,
  delivrance: FaDove,
  bergerie: FaHome,
  "famille-bien-etre": FaHeart,
  "femme-sans-limite": FaFemale,
};

/** Composant d'icône d'un ministère, avec un repli pour un slug inconnu. */
export const ministryIcon = (slug) =>
  (Object.hasOwn(ICONS_BY_SLUG, slug) && ICONS_BY_SLUG[slug]) || FaChurch;
