// Source unique des médias du site (messages, louanges, témoignages).
//
// ------------------------------------------------------------------
// CONTRAT DE DONNÉES — à respecter par la future page d'administration
// ------------------------------------------------------------------
//
// Chaque média porte un champ `video` qui décide du comportement au clic :
//
//   video: { kind: "youtube", id: "dQw4w9WgXcQ" }
//     → lecture SUR LE SITE, dans une fenêtre modale (iframe YouTube).
//       Nécessite que `frame-src` autorise youtube-nocookie dans la CSP
//       de vercel.json — c'est déjà le cas.
//
//   video: { kind: "file", src: "/media/message-01.mp4" }
//     → lecture SUR LE SITE, lecteur HTML natif, fichier hébergé dans
//       `public/media/`. Aucune dépendance externe.
//
//   video: { kind: "link", url: "https://..." }
//     → ouverture DANS UN NOUVEL ONGLET (Facebook, Vimeo, site tiers…).
//       À utiliser quand la vidéo ne peut pas être embarquée.
//
//   video: null
//     → aucune vidéo rattachée. La carte reste affichée mais renvoie
//       vers la chaîne de l'église, et n'affiche pas de bouton lecture
//       trompeur.
//
// Tant que l'administration n'existe pas, `video` est à `null` partout :
// aucune référence de vidéo n'a été inventée. Renseignez un `video` sur
// n'importe quel élément ci-dessous pour voir la lecture fonctionner.

// Chaîne de l'église : destination de repli, déjà utilisée par le bandeau
// d'abonnement et le pied de page.
export const CHANNEL_URL = "https://youtube.com";

export const messages = [
  {
    id: "marcher-par-la-foi",
    title: "Marcher par la foi",
    author: "Pasteur Jean Koffi",
    date: "04 Mai 2025",
    duration: "45:30",
    image: "/images/media/message1.jpg",
    video: null,
  },
  {
    id: "la-puissance-de-la-priere",
    title: "La puissance de la prière",
    author: "Pasteur Marcel N'Guessan",
    date: "27 Avril 2025",
    duration: "38:22",
    image: "/images/media/message2.jpg",
    video: null,
  },
  {
    id: "vivre-avec-l-esprit",
    title: "Vivre avec l'Esprit",
    author: "Pasteur Jean Koffi",
    date: "20 Avril 2025",
    duration: "42:16",
    image: "/images/media/message3.jpg",
    video: null,
  },
  {
    id: "la-grace-qui-transforme",
    title: "La grâce qui transforme",
    author: "Pasteur Marcel N'Guessan",
    date: "13 Avril 2025",
    duration: "36:45",
    image: "/images/media/message4.jpg",
    video: null,
  },
];

export const louanges = [
  {
    id: "tout-est-possible",
    title: "Tout est possible",
    author: "CAVA Worship",
    duration: "03:52",
    image: "/images/media/song1.jpg",
    video: null,
  },
  {
    id: "jesus-tu-es-bon",
    title: "Jésus tu es bon",
    author: "CAVA Worship",
    duration: "06:14",
    image: "/images/media/song2.jpg",
    video: null,
  },
  {
    id: "ta-presence",
    title: "Ta présence",
    author: "CAVA Worship",
    duration: "07:08",
    image: "/images/media/song3.jpg",
    video: null,
  },
  {
    id: "mon-coeur-t-appartient",
    title: "Mon cœur t'appartient",
    author: "CAVA Worship",
    duration: "04:45",
    image: "/images/media/song4.jpg",
    video: null,
  },
];

export const temoignages = [
  {
    id: "dieu-a-change-ma-vie",
    title: "Dieu a changé ma vie",
    author: "Marie Kouassi",
    date: "11 Mai 2025",
    duration: "08:24",
    image: "/images/media/temoignage1.jpg",
    video: null,
  },
  {
    id: "gueri-par-la-grace-de-dieu",
    title: "Guéri par la grâce de Dieu",
    author: "Jean Baptiste",
    date: "04 Mai 2025",
    duration: "06:18",
    image: "/images/media/temoignage2.jpg",
    video: null,
  },
  {
    id: "une-restauration-familiale",
    title: "Une restauration familiale",
    author: "Sarah N'Guessan",
    date: "27 Avril 2025",
    duration: "10:12",
    image: "/images/media/temoignage3.jpg",
    video: null,
  },
  {
    id: "de-l-echec-a-la-victoire",
    title: "De l'échec à la victoire",
    author: "Koffi Emmanuel",
    date: "20 Avril 2025",
    duration: "07:45",
    image: "/images/media/temoignage4.jpg",
    video: null,
  },
];

// Un média se lit sur le site si sa vidéo est embarquable.
export const isPlayable = (item) =>
  item?.video?.kind === "youtube" ||
  item?.video?.kind === "file";

// Destination externe : lien explicite, ou repli sur la chaîne.
export const externalUrl = (item) =>
  item?.video?.kind === "link"
    ? item.video.url
    : CHANNEL_URL;
