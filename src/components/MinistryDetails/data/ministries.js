const defaultMission = {
  title: "Notre Mission",
  description:
    "Former des disciples engagés et accompagner chacun dans sa croissance spirituelle.",
};

const defaultVision = {
  title: "Notre Vision",
  description:
    "Voir des vies transformées par l'Évangile et équipées pour servir leur génération.",
};

const defaultStats = [
  {
    icon: "users",
    value: "150+",
    label: "Membres actifs",
  },
  {
    icon: "calendar",
    value: "12",
    label: "Activités mensuelles",
  },
  {
    icon: "leaders",
    value: "8",
    label: "Responsables",
  },
  {
    icon: "star",
    value: "5 ans",
    label: "D'existence",
  },
];

const ministries = {
  "enfance-jeunesse": {
    slug: "enfance-jeunesse",

    title: "Enfance & Jeunesse",

    description:
      "Accompagner les enfants et les jeunes dans leur marche avec Christ.",

    image: "/images/ministries/enfance.jpg",

    color: "green",

    mission: defaultMission,
    vision: defaultVision,
    stats: defaultStats,

    gallery: [],
    events: [],
    leaders: [],
    testimonials: [],
  },

  "louange-adoration": {
    slug: "louange-adoration",

    title: "Louange & Adoration",

    description:
      "Élever un son qui transforme les cœurs et attire la présence de Dieu.",

    image: "/images/ministries/louange-hero.jpg",

    color: "gold",

    mission: defaultMission,
    vision: defaultVision,
    stats: defaultStats,

    gallery: [],
    events: [],
    leaders: [],
    testimonials: [],
  },

  enseignement: {
    slug: "enseignement",

    title: "Enseignement",

    description:
      "La parole de Dieu enseignée avec clarté pour une vie transformée.",

    image: "/images/ministries/enseignement.jpg",

    color: "green",

    mission: defaultMission,
    vision: defaultVision,
    stats: defaultStats,

    gallery: [],
    events: [],
    leaders: [],
    testimonials: [],
  },

  "groupes-de-maison": {
    slug: "groupes-de-maison",

    title: "Groupes de maison",

    description:
      "Vivre la foi en petits groupes, partager et s'encourager mutuellement.",

    image: "/images/ministries/homegroup.jpg",

    color: "gold",

    mission: defaultMission,
    vision: defaultVision,
    stats: defaultStats,

    gallery: [],
    events: [],
    leaders: [],
    testimonials: [],
  },

  "action-sociale": {
    slug: "action-sociale",

    title: "Action Sociale",

    description:
      "Manifester l'amour de Christ par des actions concrètes envers notre prochain.",

    image: "/images/ministries/sociale.jpg",

    color: "green",

    mission: defaultMission,
    vision: defaultVision,
    stats: defaultStats,

    gallery: [],
    events: [],
    leaders: [],
    testimonials: [],
  },

  evangelisation: {
    slug: "evangelisation",

    title: "Évangélisation",

    description:
      "Annoncer l'Évangile et gagner des âmes pour le Royaume de Dieu.",

    image: "/images/ministries/evangelisation.jpg",

    color: "gold",

    mission: defaultMission,
    vision: defaultVision,
    stats: defaultStats,

    gallery: [],
    events: [],
    leaders: [],
    testimonials: [],
  },
};

export default ministries;