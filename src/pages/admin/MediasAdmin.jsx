import { medias } from "../../services/api";

import usePageMeta from "../../hooks/usePageMeta";

import AdminCrud from "../../components/admin/AdminCrud";

// Le modele stocke une vraie date (`publishedAt`) : c'est elle qui trie
// les medias. Le formulaire envoyait un champ `date` en texte libre
// ("04 Mai 2025"), que Mongoose ignorait — la date saisie etait perdue
// et remplacee par celle du jour.
//
// Un `<input type="date">` n'accepte que AAAA-MM-JJ, alors que la base
// renvoie une date ISO complete.
const toDateInput = (value) =>
  typeof value === "string" ? value.slice(0, 10) : "";

import {
  formToVideo,
  videoToForm,
} from "../../components/admin/AdminForm/video";

const CATEGORIES = [
  { value: "message", label: "Message" },
  { value: "louange", label: "Louange" },
  { value: "temoignage", label: "Témoignage" },
];

const CATEGORY_LABELS = CATEGORIES.reduce(
  (accumulator, item) => {
    accumulator[item.value] = item.label;

    return accumulator;
  },
  {}
);

const VIDEO_LABELS = {
  youtube: "YouTube",
  file: "Fichier",
  link: "Lien externe",
};

const fields = [
  {
    name: "title",
    label: "Titre",
    required: true,
    wide: true,
  },
  {
    name: "author",
    label: "Auteur / orateur",
  },
  {
    name: "category",
    label: "Catégorie",
    type: "select",
    options: CATEGORIES,
    required: true,
  },
  {
    name: "date",
    label: "Date de publication",
    type: "date",
    required: true,
    help: "La date affichée sur la carte est mise en forme automatiquement à partir de celle-ci.",
  },
  {
    name: "duration",
    label: "Durée",
    placeholder: "45:30",
  },
  {
    name: "image",
    label: "Image de couverture",
    type: "upload",
    folder: "medias",
    accept: "image",
    wide: true,
    help: "Envoyez un fichier depuis votre ordinateur, ou saisissez une adresse à la main pour les images déjà présentes dans le site.",
  },
  {
    name: "video",
    type: "video",
  },
];

const columns = [
  {
    key: "title",
    label: "Titre",
  },
  {
    key: "category",
    label: "Catégorie",
    render: (item) => (
      <span className="admin-crud__pill">
        {CATEGORY_LABELS[item.category] ?? "—"}
      </span>
    ),
  },
  {
    key: "author",
    label: "Auteur",
  },
  {
    key: "date",
    label: "Date",
  },
  {
    key: "video",
    label: "Vidéo",
    render: (item) =>
      item.video ? (
        VIDEO_LABELS[item.video.kind] ?? item.video.kind
      ) : (
        <span className="admin-crud__muted">Aucune</span>
      ),
  },
];

const MediasAdmin = () => {
  usePageMeta({
    title: "Médias — Administration",
    description:
      "Gestion des messages, louanges et témoignages du site CAVA.",
  });

  return (
    <AdminCrud
      resource={medias}
      fields={fields}
      columns={columns}
      labels={{
        singular: "un média",
        plural: "Médias",
        add: "Ajouter un média",
        empty:
          "Aucun média enregistré. Ajoutez un message, une louange ou un témoignage pour alimenter la page Médias.",
        loadingSuffix: "des médias",
        description:
          "Messages, louanges et témoignages affichés sur la page Médias du site.",
        formDescription:
          "Le type de vidéo détermine le comportement au clic sur le site public.",
        titleKey: "title",
      }}
      toValues={(item) => ({
        title: item?.title ?? "",
        author: item?.author ?? "",
        category: item?.category ?? "",
        date: toDateInput(item?.publishedAt),
        duration: item?.duration ?? "",
        image: item?.image ?? "",
        video: videoToForm(item?.video ?? null),
      })}
      toPayload={(values) => ({
        title: values.title.trim(),
        author: values.author.trim(),
        category: values.category,
        publishedAt: values.date || undefined,
        duration: values.duration.trim(),
        image: values.image.trim(),
        video: formToVideo(values.video),
      })}
    />
  );
};

export default MediasAdmin;
