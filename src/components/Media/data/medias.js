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

import { site } from "../../../content/settings";

import { safeHttpUrl, safeMediaSrc } from "../../../utils/safeUrl";

// Chaîne de l'église : destination de repli, lue dans les paramètres du
// site comme le pied de page (elle était recopiée ici en dur).
export const CHANNEL_URL = safeHttpUrl(
  site.social.youtube,
  "https://youtube.com"
);

// Même règle que le modèle `Media` de l'API.
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export const messages = content.messages ?? [];
export const louanges = content.louanges ?? [];
export const temoignages = content.temoignages ?? [];

// Un média se lit sur le site si sa vidéo est embarquable ET sûre :
// identifiant YouTube conforme, ou fichier sur un chemin interne / https.
// Une valeur douteuse en base ne doit pas atteindre l'iframe ni le
// lecteur (voir utils/safeUrl.js).
export const isPlayable = (item) =>
  (item?.video?.kind === "youtube" && YOUTUBE_ID.test(item.video.id ?? "")) ||
  (item?.video?.kind === "file" && Boolean(safeMediaSrc(item.video.src)));

// Source sûre d'un fichier vidéo, ou null.
export const playableSrc = (item) => safeMediaSrc(item?.video?.src);

// Destination externe : lien explicite s'il est en http(s), sinon repli
// sur la chaîne.
export const externalUrl = (item) =>
  item?.video?.kind === "link"
    ? safeHttpUrl(item.video.url, CHANNEL_URL)
    : CHANNEL_URL;
