// Données d'amorçage, transcrites depuis le contenu publié du front.
//
// POURQUOI UNE TRANSCRIPTION plutôt qu'un import direct des fichiers
// de `src/components/.../data/*.js` ? Ces fichiers importent des
// images (`import img from "../../assets/images/x.jpg"`), ce que Node
// ne sait pas résoudre sans bundler. Les chemins ci-dessous pointent
// donc vers `public/`, servi tel quel par le site.
//
// Ce fichier n'a vocation à servir qu'une fois. Passé l'amorçage, la
// base fait autorité et le contenu se modifie depuis l'administration.

const ADDRESS =
  "Angré château, non loin de l'institut des jésuites";

export const seedEvents = [
  {
    slug: "culte-s-offrir-a-dieu",
    title: "Culte S'OFFRIR À DIEU",
    description:
      "Temps d'adoration, de prière et d'enseignement.",
    content: [
      "Un culte spécial placé sous le thème « S'offrir à Dieu ». Une invitation à remettre à Dieu non seulement nos activités, mais notre vie entière.",
      "La matinée articule un temps de louange conduit par l'équipe d'adoration, un message centré sur les Écritures, puis un moment de prière et de consécration personnelle.",
    ],
    startAt: new Date("2025-06-15T08:30:00+00:00"),
    endAt: new Date("2025-06-15T11:30:00+00:00"),
    time: "08h30",
    endTime: "11h30",
    location: "CAVA, Abidjan",
    address: ADDRESS,
    audience: "Ouvert à tous",
    image: "/images/events/event-1.jpg",
    color: "green",
    status: "published",
  },
  {
    slug: "ecole-de-la-foi",
    title: "ÉCOLE DE LA FOI",
    description:
      "Formation biblique et croissance spirituelle.",
    content: [
      "Un enseignement structuré pour affermir les bases de la foi et apprendre à lire les Écritures par soi-même.",
      "Chaque séance associe un temps d'enseignement et un temps d'échange, afin que les questions trouvent une réponse concrète.",
    ],
    startAt: new Date("2025-06-17T18:30:00+00:00"),
    endAt: new Date("2025-06-17T20:30:00+00:00"),
    time: "18h30",
    endTime: "20h30",
    location: "CAVA, Abidjan",
    address: ADDRESS,
    audience: "Ouvert à tous",
    image: "/images/events/event-2.jpg",
    color: "yellow",
    status: "published",
  },
  {
    slug: "camp-de-formation-spirituelle",
    title: "Camp de Formation Spirituelle",
    description:
      "Deux journées de formation, de prière et de communion fraternelle.",
    content: [
      "Deux journées pour se former, prier ensemble et approfondir sa marche avec Christ, loin des sollicitations du quotidien.",
      "Le camp alterne enseignements, ateliers en petits groupes et temps de prière.",
    ],
    theme: "Persévérer dans la discipline spirituelle",
    speaker: {
      name: "Pasteur Israël Liaide",
      role: "Orateur invité",
    },
    startAt: new Date("2025-06-27T09:00:00+00:00"),
    endAt: new Date("2025-06-28T17:00:00+00:00"),
    time: "09h00",
    endTime: "17h00",
    location: "CAVA, Abidjan",
    address: ADDRESS,
    audience: "Ouvert à tous",
    image: "/images/events/event-3.jpg",
    color: "yellow",
    status: "published",
  },
];

const ministry = (
  slug,
  title,
  description,
  image,
  color,
  order
) => ({
  slug,
  title,
  description,
  image,
  color,
  order,
  status: "published",
  mission: {
    title: "Notre Mission",
    description:
      "Former des disciples engagés et accompagner chacun dans sa croissance spirituelle.",
  },
  vision: {
    title: "Notre Vision",
    description:
      "Voir des vies transformées par l'Évangile et équipées pour servir leur génération.",
  },
  stats: [],
  leaders: [],
  gallery: [],
  testimonials: [],
});

export const seedMinistries = [
  ministry(
    "enfance-jeunesse",
    "Enfance & Jeunesse",
    "Accompagner les enfants et les jeunes dans leur marche avec Christ.",
    "/images/ministries/enfance.jpg",
    "green",
    1
  ),
  ministry(
    "louange-adoration",
    "Louange & Adoration",
    "Élever un son qui transforme les cœurs et attire la présence de Dieu.",
    "/images/ministries/louange-hero.jpg",
    "gold",
    2
  ),
  ministry(
    "enseignement",
    "Enseignement",
    "La parole de Dieu enseignée avec clarté pour une vie transformée.",
    "/images/ministries/enseignement.jpg",
    "green",
    3
  ),
  ministry(
    "groupes-de-maison",
    "Groupes de maison",
    "Vivre la foi en petits groupes, partager et s'encourager mutuellement.",
    "/images/ministries/homegroup.jpg",
    "gold",
    4
  ),
  ministry(
    "action-sociale",
    "Action Sociale",
    "Manifester l'amour de Christ par des actions concrètes envers notre prochain.",
    "/images/ministries/sociale.jpg",
    "green",
    5
  ),
  ministry(
    "evangelisation",
    "Évangélisation",
    "Annoncer l'Évangile et gagner des âmes pour le Royaume de Dieu.",
    "/images/ministries/evangelisation.jpg",
    "gold",
    6
  ),
];

// `video: null` volontaire : aucune référence de vidéo n'a été
// inventée. Elles seront renseignées depuis l'administration.
const media = (
  title,
  author,
  category,
  duration,
  image,
  publishedAt
) => ({
  title,
  author,
  category,
  duration,
  image,
  publishedAt: new Date(publishedAt),
  video: null,
  status: "published",
});

export const seedMedias = [
  media("Marcher par la foi", "Pasteur Jean Koffi", "message", "45:30", "/images/media/message1.jpg", "2025-05-04"),
  media("La puissance de la prière", "Pasteur Marcel N'Guessan", "message", "38:22", "/images/media/message2.jpg", "2025-04-27"),
  media("Vivre avec l'Esprit", "Pasteur Jean Koffi", "message", "42:16", "/images/media/message3.jpg", "2025-04-20"),
  media("La grâce qui transforme", "Pasteur Marcel N'Guessan", "message", "36:45", "/images/media/message4.jpg", "2025-04-13"),

  media("Tout est possible", "CAVA Worship", "louange", "03:52", "/images/media/song1.jpg", "2025-05-04"),
  media("Jésus tu es bon", "CAVA Worship", "louange", "06:14", "/images/media/song2.jpg", "2025-04-27"),
  media("Ta présence", "CAVA Worship", "louange", "07:08", "/images/media/song3.jpg", "2025-04-20"),
  media("Mon cœur t'appartient", "CAVA Worship", "louange", "04:45", "/images/media/song4.jpg", "2025-04-13"),

  media("Dieu a changé ma vie", "Marie Kouassi", "temoignage", "08:24", "/images/media/temoignage1.jpg", "2025-05-11"),
  media("Guéri par la grâce de Dieu", "Jean Baptiste", "temoignage", "06:18", "/images/media/temoignage2.jpg", "2025-05-04"),
  media("Une restauration familiale", "Sarah N'Guessan", "temoignage", "10:12", "/images/media/temoignage3.jpg", "2025-04-27"),
  media("De l'échec à la victoire", "Koffi Emmanuel", "temoignage", "07:45", "/images/media/temoignage4.jpg", "2025-04-20"),
];
