import { socialAidTypes } from "../../../services/api";

import AdminCrud from "../../../components/admin/AdminCrud";

import usePageMeta from "../../../hooks/usePageMeta";

// Calqué sur DonationTypesAdmin.jsx : même ressource CRUD générique
// (`AdminCrud`), même forme de champs/colonnes. Les 7 catégories par
// défaut du cahier des charges (Décès, Naissance, Maladie, Aide
// sociale, Urgence, Exceptionnelle, Autre) sont amorcées côté backend
// (seed), pas ici — cet écran ne fait qu'administrer la liste.
const fields = [
  { name: "name", label: "Nom du type d'aide", required: true, placeholder: "Décès" },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    rows: 3,
    help: "Facultatif — sert de repère interne pour l'agent qui enregistre une demande.",
  },
  { name: "order", label: "Ordre d'affichage", type: "number", help: "Les plus petits nombres apparaissent en premier." },
  { name: "active", label: "Proposé lors d'une nouvelle demande", type: "checkbox" },
];

const columns = [
  { key: "name", label: "Type" },
  { key: "description", label: "Description" },
  {
    key: "active",
    label: "Statut",
    render: (item) =>
      item.active ? "Actif" : <span className="admin-crud__muted">Inactif</span>,
  },
];

const SocialAidTypesAdmin = () => {
  usePageMeta({
    title: "Service Social — Types d'aide",
    description: "Gestion des types d'aide sociale proposés dans le module Service Social du CAVA.",
  });

  return (
    <AdminCrud
      resource={socialAidTypes}
      fields={fields}
      columns={columns}
      labels={{
        singular: "un type d'aide",
        plural: "Types d'aide",
        add: "Ajouter un type d'aide",
        empty: "Aucun type d'aide enregistré. Le formulaire de nouvelle demande n'affichera aucune option tant qu'aucun n'est actif.",
        loadingSuffix: "des types d'aide",
        description: "Une nouvelle catégorie d'aide sociale s'ajoute ici, sans modification de code.",
        titleKey: "name",
      }}
      toValues={(item) => ({
        name: item?.name ?? "",
        description: item?.description ?? "",
        order: item?.order ?? 0,
        active: item?.active ?? true,
      })}
      toPayload={(values) => ({
        name: values.name.trim(),
        description: values.description.trim(),
        order: Number(values.order) || 0,
        active: Boolean(values.active),
      })}
    />
  );
};

export default SocialAidTypesAdmin;
