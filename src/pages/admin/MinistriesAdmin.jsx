import { ministries } from "../../services/api";

import usePageMeta from "../../hooks/usePageMeta";

import AdminCrud from "../../components/admin/AdminCrud";

const fields = [
  {
    name: "title",
    label: "Nom du ministère",
    required: true,
    wide: true,
  },
  {
    name: "slug",
    label: "Identifiant d'URL (slug)",
    placeholder: "enfance-jeunesse",
    required: true,
    help: "Utilisé dans l'adresse /ministries/<slug>. Sans espaces ni accents.",
  },
  {
    name: "image",
    label: "Image de couverture",
    type: "upload",
    folder: "ministries",
    accept: "image",
    wide: true,
    help: "Envoyez un fichier depuis votre ordinateur, ou saisissez une adresse à la main pour les images déjà présentes dans le site.",
  },
  {
    name: "description",
    label: "Description courte",
    type: "textarea",
    wide: true,
    rows: 3,
    help: "Affichée sur la carte du ministère dans la grille.",
  },
  {
    name: "responsible",
    label: "Responsable",
  },
  {
    name: "schedule",
    label: "Horaire principal",
    placeholder: "Dimanche, 09h00",
  },
  {
    name: "stats",
    label: "Statistiques",
    type: "repeater",
    max: 8,
    itemLabel: "Statistique",
    addLabel: "Ajouter une statistique",
    emptyText:
      "Aucune statistique. La page du ministère affichera « Aucune statistique » tant que cette liste reste vide.",
    wide: true,
    // Les icônes correspondent à l'énumération du modèle : toute autre
    // valeur serait refusée à l'enregistrement.
    fields: [
      {
        name: "icon",
        label: "Icône",
        type: "select",
        options: [
          { value: "users", label: "Personnes" },
          { value: "calendar", label: "Calendrier" },
          { value: "leaders", label: "Responsables" },
          { value: "star", label: "Étoile" },
        ],
      },
      {
        name: "value",
        label: "Valeur",
        placeholder: "180+",
      },
      {
        name: "label",
        label: "Libellé",
        placeholder: "Enfants et jeunes",
      },
    ],
  },
  {
    name: "leaders",
    label: "Responsables",
    type: "repeater",
    max: 20,
    itemLabel: "Responsable",
    addLabel: "Ajouter un responsable",
    folder: "ministries",
    wide: true,
    fields: [
      {
        name: "name",
        label: "Nom",
        placeholder: "Fr. Aristide Yao",
      },
      {
        name: "role",
        label: "Fonction",
        placeholder: "Responsable principal",
      },
      {
        name: "bio",
        label: "Présentation",
        type: "textarea",
        wide: true,
        placeholder:
          "Quelques lignes sur son parcours et son rôle.",
      },
      {
        name: "image",
        label: "Photo",
        type: "upload",
        wide: true,
      },
    ],
  },
  {
    name: "testimonials",
    label: "Témoignages",
    type: "repeater",
    max: 20,
    itemLabel: "Témoignage",
    addLabel: "Ajouter un témoignage",
    wide: true,
    fields: [
      {
        name: "author",
        label: "Auteur",
        placeholder: "Mme Adjoua T.",
      },
      {
        name: "rating",
        label: "Note (1 à 5)",
        type: "number",
        min: 1,
        max: 5,
        default: 5,
      },
      {
        name: "quote",
        label: "Témoignage",
        type: "textarea",
        wide: true,
        rows: 3,
        placeholder: "Ce que cette personne a vécu…",
      },
    ],
  },
  {
    name: "gallery",
    label: "Galerie de photos",
    type: "gallery",
    folder: "ministries",
    max: 30,
    wide: true,
    help: "Photos affichées sur la page publique du ministère. L'ordre compte : faites-les glisser pour le modifier.",
  },
];

const columns = [
  {
    key: "title",
    label: "Ministère",
  },
  {
    key: "slug",
    label: "Slug",
    render: (item) => (
      <span className="admin-crud__muted">
        /ministries/{item.slug ?? "—"}
      </span>
    ),
  },
  {
    key: "responsible",
    label: "Responsable",
  },
];

const MinistriesAdmin = () => {
  usePageMeta({
    title: "Ministères — Administration",
    description:
      "Gestion des ministères du Centre Apostolique Vie et Abondance.",
  });

  return (
    <AdminCrud
      resource={ministries}
      fields={fields}
      columns={columns}
      labels={{
        singular: "un ministère",
        plural: "Ministères",
        add: "Ajouter un ministère",
        empty:
          "Aucun ministère enregistré. Ajoutez-en un pour qu'il apparaisse sur la page Ministères.",
        loadingSuffix: "des ministères",
        description:
          "Les ministères présentés sur le site. La galerie de photos est modifiable ici ; le contenu détaillé (mission, vision, témoignages) reste pour l'instant dans le code.",
        titleKey: "title",
      }}
    />
  );
};

export default MinistriesAdmin;
