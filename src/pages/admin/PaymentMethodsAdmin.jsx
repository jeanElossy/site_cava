import { paymentMethods } from "../../services/api";

import AdminCrud from "../../components/admin/AdminCrud";

import usePageMeta from "../../hooks/usePageMeta";

// Gestion des moyens de paiement Mobile Money affichés dans le tunnel
// de don. Un moyen créé ici reste inactif tant que son image QR et
// son numéro ne sont pas renseignés — voir PaymentMethod.js.
const fields = [
  { name: "name", label: "Nom du moyen", required: true, placeholder: "Orange Money" },
  {
    name: "image",
    label: "QR code officiel",
    type: "upload",
    folder: "paymentMethods",
    accept: "image",
    wide: true,
    help: "Le QR Mobile Money réel de l'église pour ce moyen — c'est lui qui s'affiche au donateur.",
  },
  { name: "accountNumber", label: "Numéro associé", placeholder: "07 00 00 00 00" },
  { name: "holderName", label: "Nom du titulaire", placeholder: "Centre Apostolique Vie et Abondance" },
  { name: "order", label: "Ordre d'affichage", type: "number", help: "Les plus petits nombres apparaissent en premier." },
  {
    name: "active",
    label: "Visible dans le tunnel de don",
    type: "checkbox",
    wide: true,
    help: "N'activez qu'une fois l'image QR et le numéro renseignés — un moyen sans QR ne doit jamais apparaître aux fidèles.",
  },
];

const columns = [
  { key: "name", label: "Moyen" },
  { key: "accountNumber", label: "Numéro" },
  { key: "holderName", label: "Titulaire" },
  {
    key: "active",
    label: "Statut",
    render: (item) =>
      item.active ? "Actif" : <span className="admin-crud__muted">Inactif</span>,
  },
];

const PaymentMethodsAdmin = () => {
  usePageMeta({
    title: "Moyens de paiement — Administration",
    description: "Gestion des QR codes Mobile Money du Centre Apostolique Vie et Abondance.",
  });

  return (
    <AdminCrud
      resource={paymentMethods}
      fields={fields}
      columns={columns}
      labels={{
        singular: "un moyen de paiement",
        plural: "Moyens de paiement",
        add: "Ajouter un moyen de paiement",
        empty: "Aucun moyen de paiement enregistré. Le tunnel de don n'affichera aucune option tant qu'aucun n'est actif.",
        loadingSuffix: "des moyens de paiement",
        description: "Si un numéro Mobile Money change, remplacez simplement le QR ici — aucune modification de code n'est nécessaire.",
        titleKey: "name",
      }}
      toValues={(item) => ({
        name: item?.name ?? "",
        image: item?.image?.url ?? "",
        accountNumber: item?.accountNumber ?? "",
        holderName: item?.holderName ?? "",
        order: item?.order ?? 0,
        active: Boolean(item?.active),
      })}
      toPayload={(values) => ({
        name: values.name.trim(),
        // `undefined` n'aurait pas survécu à `JSON.stringify` : la clé
        // disparaissait du corps de la requête, et vider le champ dans
        // le formulaire ne retirait donc JAMAIS le QR côté serveur.
        // Une forme explicitement vide, elle, écrase la précédente.
        image: values.image ? { url: values.image } : { url: "", publicId: "" },
        accountNumber: values.accountNumber.trim(),
        holderName: values.holderName.trim(),
        order: Number(values.order) || 0,
        active: Boolean(values.active),
      })}
    />
  );
};

export default PaymentMethodsAdmin;
