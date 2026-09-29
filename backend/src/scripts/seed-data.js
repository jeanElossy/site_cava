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

// ---- Moyens de paiement --------------------------------------------
// `active: false` volontairement : sans image QR ni numéro réels,
// aucun de ces moyens ne doit apparaître aux fidèles avant que
// l'administration ne les complète et ne les active.
export const seedPaymentMethods = [
  { name: "Orange Money", order: 1 },
  { name: "MTN Money", order: 2 },
  { name: "Moov Money", order: 3 },
  { name: "Wave", order: 4 },
];

// ---- Types de don ---------------------------------------------------
export const seedDonationTypes = [
  { name: "Dîme", order: 1 },
  { name: "Offrande", order: 2 },
  { name: "Action de grâce", order: 3 },
  { name: "Construction", order: 4 },
  { name: "Mission", order: 5 },
  { name: "Don libre", order: 6 },
];

// Postes ouverts de l'appel à candidatures (/appel-a-candidature).
//
// Ce sont les six domaines de la campagne en cours. Ils sont amorcés
// ici plutôt qu'écrits en dur dans le site : l'administration doit
// pouvoir les modifier, en ajouter et en archiver sans passer par un
// déploiement. L'amorçage est idempotent (clé `slug`), il ne réécrit
// donc jamais un poste déjà retouché depuis /admin.
export const seedPositions = [
  {
    slug: "ifip-vie",
    title: "IFIP.VIE",
    subtitle: "Futurs formateurs",
    variant: "light",
    icon: "graduation",
    order: 1,
    intro:
      "L'Institut de Formation IFIP.VIE forme les fidèles appelés à enseigner et à transmettre. Nous recherchons des formateurs capables d'accompagner une promotion du début à la fin de son cursus.",
    missions: [
      { value: "Préparer et animer les sessions de formation." },
      { value: "Accompagner les apprenants tout au long du cursus." },
      { value: "Participer à l'élaboration des supports pédagogiques." },
      { value: "Évaluer les acquis et rendre compte à la direction de l'institut." },
    ],
    requirements: [
      { value: "Être membre actif de la communauté ÇA.VA." },
      { value: "Avoir une expérience de l'enseignement ou de la formation." },
      { value: "Maîtriser le sujet que l'on souhaite enseigner." },
      { value: "Savoir préparer une séance et tenir un groupe." },
    ],
    commitment:
      "Une session par mois en moyenne, plus le temps de préparation. Les dates sont arrêtées à l'avance avec la direction de l'institut.",
    openings: "À déterminer",
  },
  {
    slug: "delivrance",
    title: "Délivrance",
    subtitle: "Futurs serviteurs",
    variant: "gold",
    icon: "prayer",
    order: 2,
    intro:
      "Le département Délivrance accompagne les personnes qui demandent une prière de libération. C'est un service exigeant, qui demande de la maturité spirituelle et une grande discrétion.",
    missions: [
      { value: "Accueillir et écouter les personnes qui se présentent." },
      { value: "Participer aux séances de prière encadrées par les responsables." },
      { value: "Assurer le suivi des personnes accompagnées." },
      { value: "Garder une confidentialité absolue sur les situations rencontrées." },
    ],
    requirements: [
      { value: "Être membre actif et connu de la communauté." },
      { value: "Faire preuve d'une vie de prière régulière." },
      { value: "Savoir écouter sans juger." },
      { value: "Accepter d'être formé(e) avant toute prise de service." },
    ],
    commitment:
      "Présence aux séances programmées et aux temps de formation préalables. L'engagement se prend pour une année renouvelable.",
    openings: "À déterminer",
  },
  {
    slug: "bergeries",
    title: "Bergeries",
    subtitle: "Coordinateur des bergeries",
    variant: "dark",
    icon: "flock",
    order: 3,
    intro:
      "Le coordinateur des bergeries fait le lien entre la direction de l'Église et les responsables de chaque bergerie. C'est un poste de coordination, au service de ceux qui encadrent déjà.",
    missions: [
      { value: "Accompagner les responsables de bergerie au quotidien." },
      { value: "Veiller à la tenue des rencontres et au suivi des membres." },
      { value: "Faire remonter les besoins et les difficultés à la direction." },
      { value: "Participer à la répartition des nouveaux membres entre les bergeries." },
    ],
    requirements: [
      { value: "Être membre actif depuis plusieurs années." },
      { value: "Avoir déjà servi dans une bergerie." },
      { value: "Savoir organiser, planifier et rendre compte." },
      { value: "Être disponible pour des déplacements entre les bergeries." },
    ],
    commitment:
      "Engagement régulier, avec un point mensuel avec la direction et une présence aux rencontres de bergeries.",
    openings: "1",
  },
  {
    slug: "direction-des-cultes",
    title: "Direction des cultes",
    subtitle: "Futurs serviteurs",
    variant: "gold",
    icon: "worship",
    order: 4,
    intro:
      "La direction des cultes prépare et conduit le déroulement des célébrations. Le service demande de la rigueur : c'est l'équipe qui tient le fil du culte du début à la fin.",
    missions: [
      { value: "Préparer le déroulé des cultes avec les équipes concernées." },
      { value: "Conduire la célébration le jour venu." },
      { value: "Coordonner louange, prédication, annonces et offrandes." },
      { value: "Faire le bilan après chaque culte pour ajuster le suivant." },
    ],
    requirements: [
      { value: "Être membre actif de la communauté ÇA.VA." },
      { value: "Avoir de l'aisance à l'oral devant l'assemblée." },
      { value: "Savoir tenir un horaire et gérer un imprévu." },
      { value: "Accepter d'être formé(e) et accompagné(e) au démarrage." },
    ],
    commitment:
      "Rotation entre serviteurs, avec une présence obligatoire aux répétitions et à la préparation du culte attribué.",
    openings: "À déterminer",
  },
  {
    slug: "finance-administration",
    title: "Finance & Administration",
    subtitle: "Équipe à constituer",
    variant: "dark",
    icon: "finance",
    order: 5,
    intro:
      "L'équipe Finance & Administration tient les comptes de l'Église et sécurise ses procédures. Les candidatures de professionnels du chiffre et de la gestion sont particulièrement attendues.",
    missions: [
      { value: "Tenir la comptabilité et suivre les encaissements." },
      { value: "Préparer les états financiers présentés à la direction." },
      { value: "Participer au contrôle interne et au respect des procédures." },
      { value: "Contribuer à la préparation du budget annuel." },
    ],
    requirements: [
      { value: "Être membre actif de la communauté ÇA.VA." },
      { value: "Avoir une formation ou une expérience en comptabilité, gestion ou audit." },
      { value: "Faire preuve d'une rigueur et d'une intégrité sans faille." },
      { value: "Respecter la confidentialité des informations financières." },
    ],
    commitment:
      "Engagement régulier, avec des échéances mensuelles de clôture. Le rythme est arrêté avec le responsable du département.",
    openings: "Équipe à constituer",
  },
  {
    slug: "secretariat-executif",
    title: "Secrétariat exécutif",
    subtitle: "Équipe à constituer",
    variant: "light",
    icon: "secretariat",
    order: 6,
    intro:
      "Le secrétariat exécutif assure la mémoire administrative de l'Église : courriers, comptes rendus, archives et suivi des décisions prises.",
    missions: [
      { value: "Rédiger les comptes rendus des réunions." },
      { value: "Assurer le classement et l'archivage des documents." },
      { value: "Suivre le courrier entrant et sortant." },
      { value: "Veiller à l'exécution des décisions prises en réunion." },
    ],
    requirements: [
      { value: "Être membre actif de la communauté ÇA.VA." },
      { value: "Maîtriser l'expression écrite en français." },
      { value: "Savoir utiliser les outils bureautiques courants." },
      { value: "Être organisé(e) et discret(e)." },
    ],
    commitment:
      "Présence aux réunions de direction et disponibilité pour la rédaction des comptes rendus dans les jours qui suivent.",
    openings: "Équipe à constituer",
  },
];
