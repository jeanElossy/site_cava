import { events } from "../../services/api";

import usePageMeta from "../../hooks/usePageMeta";

import AdminCrud from "../../components/admin/AdminCrud";

const fields = [
  {
    name: "title",
    label: "Titre de l'événement",
    required: true,
    wide: true,
  },
  {
    name: "date",
    label: "Date affichée",
    placeholder: "Dimanche 15 Juin 2025",
    required: true,
  },
  {
    name: "time",
    label: "Heure de début",
    placeholder: "08h30",
  },
  {
    name: "endTime",
    label: "Heure de fin",
    placeholder: "11h30",
  },
  {
    name: "location",
    label: "Lieu",
    placeholder: "CAVA, Abidjan",
  },
  {
    name: "address",
    label: "Adresse complète",
    wide: true,
  },
  {
    name: "audience",
    label: "Public concerné",
    placeholder: "Ouvert à tous",
  },
  {
    name: "image",
    label: "Image de couverture",
    placeholder: "/images/events/culte.jpg",
    help: "Chemin vers un fichier de public/images/. Non vérifié au build.",
  },
  {
    name: "description",
    label: "Description courte",
    type: "textarea",
    wide: true,
    rows: 3,
    help: "Affichée sur la carte de l'événement dans les listes.",
  },
];

const columns = [
  {
    key: "title",
    label: "Événement",
  },
  {
    key: "date",
    label: "Date",
  },
  {
    key: "time",
    label: "Heure",
  },
  {
    key: "location",
    label: "Lieu",
  },
];

const EventsAdmin = () => {
  usePageMeta({
    title: "Événements — Administration",
    description:
      "Gestion des événements du Centre Apostolique Vie et Abondance.",
  });

  return (
    <AdminCrud
      resource={events}
      fields={fields}
      columns={columns}
      labels={{
        singular: "un événement",
        plural: "Événements",
        add: "Ajouter un événement",
        empty:
          "Aucun événement enregistré. Créez-en un pour qu'il apparaisse dans l'agenda du site.",
        loadingSuffix: "des événements",
        description:
          "Cultes, conférences et rendez-vous affichés sur la page Événements.",
        titleKey: "title",
      }}
    />
  );
};

export default EventsAdmin;
