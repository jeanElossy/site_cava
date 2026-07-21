// Contrat du champ `video` — repris de
// `src/components/Media/data/medias.js`, qui fait foi :
//
//   { kind: "youtube", id }   lecture en modale sur le site
//   { kind: "file",    src }  lecteur natif, fichier de public/media/
//   { kind: "link",    url }  ouverture dans un nouvel onglet
//   null                      aucune vidéo rattachée
//
// Ces fonctions traduisent ce contrat dans les deux sens, entre la
// donnée stockée et l'état du formulaire d'administration.

export const VIDEO_KINDS = [
  {
    value: "none",
    label: "Aucune vidéo",
    help: "La carte reste affichée et renvoie vers la chaîne de l'église, sans bouton de lecture trompeur.",
  },
  {
    value: "youtube",
    label: "YouTube (lecture sur le site)",
    field: "id",
    fieldLabel: "Identifiant de la vidéo YouTube",
    placeholder: "dQw4w9WgXcQ",
    help: "Uniquement l'identifiant, pas l'URL complète. Exemple : pour https://youtu.be/dQw4w9WgXcQ, saisir dQw4w9WgXcQ.",
  },
  {
    value: "file",
    label: "Fichier vidéo ou audio (lecture sur le site)",
    field: "src",
    fieldLabel: "Fichier",
    // `upload: true` : ce type n'attend plus un chemin saisi à la
    // main, mais un fichier envoyé depuis l'ordinateur.
    upload: true,
    uploadFolder: "medias",
    uploadAccept: "media",
    placeholder: "/media/message-01.mp4",
    help: "Envoyez le fichier depuis votre ordinateur (100 Mo maximum), ou saisissez une adresse à la main pour les fichiers déjà présents dans le site.",
  },
  {
    value: "link",
    label: "Lien externe (nouvel onglet)",
    field: "url",
    fieldLabel: "Adresse de la vidéo",
    placeholder: "https://…",
    help: "À utiliser quand la vidéo ne peut pas être embarquée (Facebook, Vimeo…).",
  },
];

export const videoToForm = (video) => {
  if (!video) return { kind: "none", value: "" };

  const descriptor = VIDEO_KINDS.find(
    (item) => item.value === video.kind
  );

  if (!descriptor?.field) return { kind: "none", value: "" };

  return {
    kind: video.kind,
    value: video[descriptor.field] ?? "",
  };
};

export const formToVideo = ({ kind, value }) => {
  const descriptor = VIDEO_KINDS.find(
    (item) => item.value === kind
  );

  if (!descriptor?.field || !value.trim()) return null;

  return {
    kind,
    [descriptor.field]: value.trim(),
  };
};
