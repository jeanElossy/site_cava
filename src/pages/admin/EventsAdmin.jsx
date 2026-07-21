import { events } from "../../services/api";

import usePageMeta from "../../hooks/usePageMeta";

import AdminCrud from "../../components/admin/AdminCrud";

// Conversions entre le formulaire et le modele.
//
// Le modele fait autorite sur la DATE (`startAt`, un vrai objet Date) :
// trier ou filtrer sur du texte serait fragile. Les champs `time` et
// `endTime` restent de l'affichage libre ("08h30").
//
// Le formulaire envoyait auparavant un champ `date` en texte libre, que
// Mongoose ignorait, et n'envoyait ni `slug` ni `startAt` — tous deux
// obligatoires. Aucun evenement ne pouvait donc etre cree.

// "08h30", "8h", "08:30" -> "08:30". Renvoie null si illisible.
const toClock = (value) => {
  const match = String(value ?? "").match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);

  if (!match) return null;

  const hours = String(match[1]).padStart(2, "0");
  const minutes = match[2] ?? "00";

  return `${hours}:${minutes}`;
};

// Combine une date AAAA-MM-JJ et une heure en instant UTC.
//
// UTC volontairement : le reste de la chaine (fetch-content.mjs) lit
// ces dates avec `getUTCDate()`. Utiliser le fuseau local du navigateur
// decalerait l'affichage d'un jour pour les evenements du matin.
const toInstant = (date, time) => {
  if (!date) return null;

  return `${date}T${toClock(time) ?? "00:00"}:00.000Z`;
};

const toDateInput = (value) =>
  typeof value === "string" ? value.slice(0, 10) : "";

// Accents et ponctuation retires : le modele n'accepte que minuscules,
// chiffres et tirets.
const slugify = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const fields = [
  {
    name: "title",
    label: "Titre de l'événement",
    required: true,
    wide: true,
  },
  {
    name: "slug",
    label: "Identifiant d'URL (slug)",
    placeholder: "culte-s-offrir-a-dieu",
    help: "Utilisé dans l'adresse /events/<slug>. Laissez vide : il sera déduit du titre.",
  },
  {
    name: "date",
    label: "Date",
    type: "date",
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
    name: "theme",
    label: "Thème",
    placeholder: "S'offrir à Dieu",
  },
  {
    name: "color",
    label: "Couleur de la pastille",
    type: "select",
    options: [
      { value: "green", label: "Vert" },
      { value: "yellow", label: "Jaune" },
    ],
  },
  {
    name: "image",
    label: "Image de couverture",
    type: "upload",
    folder: "events",
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
    help: "Affichée sur la carte de l'événement dans les listes.",
  },
  {
    name: "content",
    label: "Contenu détaillé",
    type: "textarea",
    wide: true,
    rows: 6,
    help: "Affiché sur la page de détail. Séparez les paragraphes par une ligne vide.",
  },
  {
    name: "speakerName",
    label: "Intervenant",
    placeholder: "Pasteur Jean Kouassi",
  },
  {
    name: "speakerRole",
    label: "Fonction de l'intervenant",
    placeholder: "Pasteur principal",
  },
  {
    name: "speakerBio",
    label: "Présentation de l'intervenant",
    type: "textarea",
    wide: true,
    rows: 2,
  },
];

const columns = [
  {
    key: "title",
    label: "Événement",
  },
  {
    key: "startAt",
    label: "Date",
    render: (item) =>
      item.startAt
        ? new Date(item.startAt).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })
        : "—",
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
      toValues={(item) => ({
        title: item?.title ?? "",
        slug: item?.slug ?? "",
        date: toDateInput(item?.startAt),
        time: item?.time ?? "",
        endTime: item?.endTime ?? "",
        location: item?.location ?? "",
        address: item?.address ?? "",
        audience: item?.audience ?? "",
        theme: item?.theme ?? "",
        color: item?.color ?? "green",
        image: item?.image ?? "",
        description: item?.description ?? "",
        // Le modele stocke un tableau de paragraphes ; le formulaire
        // presente un texte unique, plus naturel a saisir.
        content: (item?.content ?? []).join("\n\n"),
        speakerName: item?.speaker?.name ?? "",
        speakerRole: item?.speaker?.role ?? "",
        speakerBio: item?.speaker?.bio ?? "",
      })}
      toPayload={(values) => {
        const speaker = {
          name: values.speakerName.trim(),
          role: values.speakerRole.trim(),
          bio: values.speakerBio.trim(),
        };

        return {
          title: values.title.trim(),
          // Slug deduit du titre s'il n'est pas fourni : le modele
          // l'exige, et l'oubli bloquerait l'enregistrement.
          slug: (values.slug.trim() || slugify(values.title)),
          startAt: toInstant(values.date, values.time),
          endAt: values.endTime
            ? toInstant(values.date, values.endTime)
            : undefined,
          time: values.time.trim(),
          endTime: values.endTime.trim(),
          location: values.location.trim(),
          address: values.address.trim(),
          audience: values.audience.trim(),
          theme: values.theme.trim(),
          color: values.color || "green",
          image: values.image.trim(),
          description: values.description.trim(),
          content: values.content
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean),
          // `undefined` plutot qu'un objet vide : Mongoose ne creerait
          // sinon qu'un sous-document de champs vides.
          speaker: speaker.name ? speaker : undefined,
        };
      }}
    />
  );
};

export default EventsAdmin;
