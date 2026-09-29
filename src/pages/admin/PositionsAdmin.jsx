import { positions } from "../../services/api";

import usePageMeta from "../../hooks/usePageMeta";

import AdminCrud from "../../components/admin/AdminCrud";

// Les valeurs des listes déroulantes reprennent À L'IDENTIQUE les
// énumérations du modèle (backend/src/models/Position.js) : une valeur
// absente de l'énumération serait refusée à l'enregistrement, et une
// icône ou une couleur inconnue laisserait la carte sans fond sur le
// site public.
const fields = [
  {
    name: "title",
    label: "Intitulé du poste",
    required: true,
    wide: true,
    placeholder: "Finance & Administration",
  },
  {
    name: "slug",
    label: "Identifiant d'URL (slug)",
    required: true,
    placeholder: "finance-administration",
    help: "Utilisé dans l'adresse /appel-a-candidature/<slug>. Sans espaces ni accents. Le modifier casse les liens déjà partagés.",
  },
  {
    name: "subtitle",
    label: "Sous-titre de la carte",
    placeholder: "Équipe à constituer",
    help: "Ligne affichée sous l'intitulé sur la grille des postes.",
  },
  {
    name: "icon",
    label: "Icône",
    type: "select",
    options: [
      { value: "graduation", label: "Formation" },
      { value: "prayer", label: "Prière" },
      { value: "flock", label: "Bergeries" },
      { value: "worship", label: "Culte" },
      { value: "finance", label: "Finance" },
      { value: "secretariat", label: "Secrétariat" },
      { value: "media", label: "Communication" },
      { value: "social", label: "Aide sociale" },
    ],
  },
  {
    name: "variant",
    label: "Couleur de la carte",
    type: "select",
    options: [
      { value: "light", label: "Vert clair" },
      { value: "gold", label: "Jaune" },
      { value: "dark", label: "Vert foncé" },
    ],
    help: "Alternez les trois couleurs pour garder le rythme visuel de la grille.",
  },
  {
    name: "order",
    label: "Ordre d'affichage",
    type: "number",
    help: "Les postes sont classés par ordre croissant sur la page Appel à candidatures.",
  },
  {
    name: "openings",
    label: "Places à pourvoir",
    placeholder: "1, 3, Équipe à constituer…",
    help: "Texte libre, affiché tel quel sur la fiche du poste.",
  },
  {
    name: "intro",
    label: "Présentation du poste",
    type: "textarea",
    rows: 4,
    wide: true,
    help: "Paragraphe d'introduction de la fiche. Ses 160 premiers caractères servent aussi de description pour les moteurs de recherche.",
  },
  {
    name: "missions",
    label: "Vos missions",
    type: "repeater",
    max: 15,
    itemLabel: "Mission",
    addLabel: "Ajouter une mission",
    emptyText:
      "Aucune mission. Le bloc « Vos missions » n'apparaîtra pas sur la fiche tant que cette liste reste vide.",
    wide: true,
    fields: [
      {
        name: "value",
        label: "Mission",
        placeholder: "Tenir la comptabilité et suivre les encaissements.",
      },
    ],
  },
  {
    name: "requirements",
    label: "Profil recherché",
    type: "repeater",
    max: 15,
    itemLabel: "Critère",
    addLabel: "Ajouter un critère",
    emptyText:
      "Aucun critère. Le bloc « Profil recherché » n'apparaîtra pas sur la fiche tant que cette liste reste vide.",
    wide: true,
    fields: [
      {
        name: "value",
        label: "Critère",
        placeholder: "Être membre actif de la communauté ÇA.VA.",
      },
    ],
  },
  {
    name: "commitment",
    label: "Engagement attendu",
    type: "textarea",
    rows: 3,
    wide: true,
    help: "Rythme et durée du service, affichés en tête de la fiche.",
  },
];

const columns = [
  { key: "order", label: "Ordre" },
  { key: "title", label: "Poste" },
  { key: "subtitle", label: "Sous-titre" },
  {
    key: "missions",
    label: "Missions",
    render: (item) => `${(item.missions ?? []).length}`,
  },
  {
    key: "requirements",
    label: "Critères",
    render: (item) => `${(item.requirements ?? []).length}`,
  },
];

const PositionsAdmin = () => {
  usePageMeta({
    title: "Postes ouverts — Administration",
    description:
      "Gestion des postes de l'appel à candidatures du Centre Apostolique Vie et Abondance.",
  });

  return (
    <AdminCrud
      resource={positions}
      fields={fields}
      columns={columns}
      labels={{
        singular: "un poste",
        plural: "Postes ouverts",
        add: "Ajouter un poste",
        empty:
          "Aucun poste enregistré. La page Appel à candidatures affichera « Aucun poste n'est ouvert pour le moment » tant que cette liste reste vide.",
        loadingSuffix: "des postes",
        description:
          "Les postes proposés sur la page Appel à candidatures, avec leur fiche détaillée. Passez un poste en brouillon pour le préparer sans le publier, ou en archivé une fois qu'il est pourvu — sans perdre sa fiche.",
        titleKey: "title",
      }}
    />
  );
};

export default PositionsAdmin;
