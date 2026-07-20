// Adaptateur — les données viennent désormais de la BASE.
//
// Ce module ne contient plus de contenu écrit en dur. Il lit
// `src/content/medias.json`, généré au moment du build par
// `scripts/fetch-content.mjs`, qui interroge l'API.
//
// Interface INCHANGÉE : `messages`, `louanges`, `temoignages`,
// `isPlayable` et `externalUrl`. Aucun composant n'a été modifié.
//
// Le contrat du champ `video` est le même que côté base (voir le
// modèle `Media` du backend, qui le valide) :
//
//   { kind: "youtube", id }  → lecture sur le site (fenêtre modale)
//   { kind: "file",    src } → lecture sur le site (fichier hébergé)
//   { kind: "link",    url } → ouverture dans un nouvel onglet
//   null                     → aucune vidéo, renvoi vers la chaîne

import content from "../../../content/medias.json";

// Chaîne de l'église : destination de repli, également utilisée par le
// bandeau d'abonnement et le pied de page.
export const CHANNEL_URL = "https://youtube.com";

export const messages = content.messages ?? [];
export const louanges = content.louanges ?? [];
export const temoignages = content.temoignages ?? [];

// Un média se lit sur le site si sa vidéo est embarquable.
export const isPlayable = (item) =>
  item?.video?.kind === "youtube" ||
  item?.video?.kind === "file";

// Destination externe : lien explicite, ou repli sur la chaîne.
export const externalUrl = (item) =>
  item?.video?.kind === "link"
    ? item.video.url
    : CHANNEL_URL;
