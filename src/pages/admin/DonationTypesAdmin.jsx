import { donationTypes } from "../../services/api";

import AdminCrud from "../../components/admin/AdminCrud";

import usePageMeta from "../../hooks/usePageMeta";

const fields = [
  { name: "name", label: "Nom du type de don", required: true, placeholder: "Dîme" },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    rows: 3,
    help: "Facultatif — n'apparaît pas forcément dans le tunnel, sert de repère interne.",
  },
  { name: "order", label: "Ordre d'affichage", type: "number", help: "Les plus petits nombres apparaissent en premier." },
  { name: "active", label: "Proposé dans le tunnel de don", type: "checkbox" },
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

const DonationTypesAdmin = () => {
  usePageMeta({
    title: "Types de don — Administration",
    description: "Gestion des types de don proposés sur le site du Centre Apostolique Vie et Abondance.",
  });

  return (
    <AdminCrud
      resource={donationTypes}
      fields={fields}
      columns={columns}
      labels={{
        singular: "un type de don",
        plural: "Types de don",
        add: "Ajouter un type de don",
        empty: "Aucun type de don enregistré. Le tunnel de don n'affichera aucune option tant qu'aucun n'est actif.",
        loadingSuffix: "des types de don",
        description: "Une nouvelle campagne (construction, mission...) s'ajoute ici, sans modification de code.",
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

export default DonationTypesAdmin;
