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
