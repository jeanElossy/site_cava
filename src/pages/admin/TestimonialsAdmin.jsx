import { testimonials } from "../../services/api";

import AdminCrud from "../../components/admin/AdminCrud";

import usePageMeta from "../../hooks/usePageMeta";

// Gestion des témoignages.
//
// ------------------------------------------------------------------
// POURQUOI CET ÉCRAN EXISTE
// ------------------------------------------------------------------
// Les témoignages étaient écrits dans le code, et ceux qui s'y
// trouvaient étaient inventés : six paroles attribuées nommément à des
// membres qui ne les avaient jamais prononcées, réparties entre la page
// Don et la page Communauté.
//
// Ils se saisissent désormais ici, par ceux qui les ont réellement
// recueillis.

const PLACEMENTS = [
  { value: "communaute", label: "Page Communauté" },
  { value: "don", label: "Page Don" },
];

const STATUSES = [
  { value: "published", label: "Publié" },
  { value: "draft", label: "Brouillon" },
  { value: "archived", label: "Archivé" },
];

const PLACEMENT_LABELS = Object.fromEntries(
  PLACEMENTS.map((item) => [item.value, item.label])
);

const fields = [
  {
    name: "name",
    label: "Nom de la personne",
    required: true,
    help: "Tel qu'il apparaîtra sur le site. Un prénom suivi d'une initiale convient si la personne préfère.",
  },
  {
    name: "role",
    label: "Qualité",
    help: "« Membre depuis 2022 », « Responsable d'accueil »… Situe la personne et rend le témoignage vérifiable.",
  },
  {
    name: "placement",
    label: "Où l'afficher",
    type: "select",
    options: PLACEMENTS,
    required: true,
    help: "La page Don parle de l'usage des contributions, la page Communauté de la vie d'église. Un même texte aux deux endroits sonnerait faux.",
  },
  {
    name: "status",
    label: "Statut",
    type: "select",
    options: STATUSES,
    help: "Passez en brouillon pour retirer immédiatement un témoignage du site, par exemple si la personne revient sur son accord.",
  },
  {
    name: "quote",
    label: "Témoignage",
    type: "textarea",
    rows: 5,
    required: true,
    wide: true,
    help: "Les mots de la personne. Corrigez l'orthographe si besoin, mais ne réécrivez pas le propos.",
  },
  {
    name: "collectedBy",
    label: "Recueilli par",
    help: "Qui a recueilli ce témoignage, pour savoir vers qui se tourner en cas de question.",
  },
  {
    name: "order",
    label: "Ordre d'affichage",
    type: "number",
    help: "Les plus petits nombres apparaissent en premier.",
  },
  {
    name: "consent",
    label: "La personne a donné son accord pour cette publication",
    type: "checkbox",
    wide: true,
    help: "Obligatoire. Publier sous le nom de quelqu'un un propos sur sa vie personnelle sans son accord lui porte préjudice, quelle que soit la bonne intention.",
  },
];

const columns = [
  { key: "name", label: "Personne" },
  {
    key: "placement",
    label: "Emplacement",
    render: (item) => (
      <span className="admin-crud__pill">
        {PLACEMENT_LABELS[item.placement] ?? "—"}
      </span>
    ),
  },
  {
    key: "quote",
    label: "Témoignage",
    render: (item) =>
      item.quote?.length > 90
        ? `${item.quote.slice(0, 90)}…`
        : (item.quote ?? "—"),
  },
  {
    key: "status",
    label: "Statut",
    render: (item) =>
      item.status === "published" ? (
        "Publié"
      ) : (
        <span className="admin-crud__muted">
          {item.status === "draft" ? "Brouillon" : "Archivé"}
        </span>
      ),
  },
];

const TestimonialsAdmin = () => {
  usePageMeta({
    title: "Témoignages — Administration",
    description:
      "Gestion des témoignages affichés sur le site du Centre Apostolique Vie et Abondance.",
  });

  return (
    <AdminCrud
      resource={testimonials}
      fields={fields}
      columns={columns}
      labels={{
        singular: "un témoignage",
        plural: "Témoignages",
        add: "Ajouter un témoignage",
        empty:
          "Aucun témoignage enregistré. Les sections « Témoignages » des pages Don et Communauté restent masquées tant qu'aucun n'est publié.",
        loadingSuffix: "des témoignages",
        description:
          "Ces témoignages sont publiés sur le site. N'y saisissez que des propos réellement recueillis, avec l'accord de la personne citée.",
        titleKey: "name",
      }}
      toValues={(item) => ({
        name: item?.name ?? "",
        role: item?.role ?? "",
        // Valeurs par défaut alignées sur le modèle, pour qu'une
        // création sans choix explicite reste valide.
        placement: item?.placement ?? "communaute",
        status: item?.status ?? "published",
        quote: item?.quote ?? "",
        collectedBy: item?.collectedBy ?? "",
        order: item?.order ?? 0,
        consent: Boolean(item?.consent),
      })}
      toPayload={(values) => ({
        name: values.name.trim(),
        role: values.role.trim(),
        placement: values.placement || "communaute",
        status: values.status || "published",
        quote: values.quote.trim(),
        collectedBy: values.collectedBy.trim(),
        order: Number(values.order) || 0,
        consent: Boolean(values.consent),
      })}
    />
  );
};

export default TestimonialsAdmin;
