// Contenu éditorial des pages de détail de ministère.
//
// Les images de galerie sont importées depuis `src/assets/images` afin d'être
// traitées (et hashées) par Vite. L'image de héros reste un chemin absolu vers
// `public/images/ministries`, comme dans le reste du site.

import worshipImg from "../../../assets/images/worship.jpg";
import childrenImg from "../../../assets/images/children.jpg";
import teachingImg from "../../../assets/images/teaching.jpg";
import homegroupImg from "../../../assets/images/homegroup.jpg";
import socialImg from "../../../assets/images/social.jpg";
import evangelismImg from "../../../assets/images/evangelism.jpg";
import familyImg from "../../../assets/images/family.jpg";
import bibleImg from "../../../assets/images/bible.jpg";
import event1Img from "../../../assets/images/event-1.jpg";
import event2Img from "../../../assets/images/event-2.jpg";
import event3Img from "../../../assets/images/event-3.jpg";
import event4Img from "../../../assets/images/event-4.jpg";
import event5Img from "../../../assets/images/event-5.jpg";

const ministries = {
  "enfance-jeunesse": {
    slug: "enfance-jeunesse",

    title: "Enfance & Jeunesse",

    description:
      "Accompagner les enfants et les jeunes dans leur marche avec Christ.",

    image: "/images/ministries/enfance.jpg",

    color: "green",

    mission: {
      title: "Notre Mission",
      description:
        "Offrir aux enfants et aux jeunes un cadre sûr et joyeux où ils découvrent Jésus, grandissent dans la foi et développent les dons que Dieu a déposés en eux.",
    },

    vision: {
      title: "Notre Vision",
      description:
        "Voir se lever une génération d'Abidjan enracinée dans la Parole, intègre dans ses choix et prête à influencer son école, sa famille et son quartier.",
    },

    stats: [
      { icon: "users", value: "180+", label: "Enfants et jeunes" },
      { icon: "calendar", value: "8", label: "Activités mensuelles" },
      { icon: "leaders", value: "14", label: "Moniteurs" },
      { icon: "star", value: "9 ans", label: "D'existence" },
    ],

    gallery: [
      childrenImg,
      familyImg,
      event2Img,
      event4Img,
      event1Img,
      teachingImg,
    ],

    events: [
      {
        day: "07",
        month: "Juin",
        title: "Camp biblique des vacances",
        time: "08h00 - 16h00",
        location: "Cour de l'église, Angré",
        description:
          "Une semaine de jeux, de louange et d'enseignements adaptés aux 6-14 ans.",
      },
      {
        day: "21",
        month: "Juin",
        title: "Journée des talents",
        time: "09h00 - 13h00",
        location: "Salle polyvalente",
        description:
          "Les jeunes présentent chant, danse, poésie et théâtre au service de Dieu.",
      },
      {
        day: "05",
        month: "Juillet",
        title: "Rentrée des moniteurs",
        time: "15h00 - 18h00",
        location: "Salle des conférences",
        description:
          "Formation et préparation de la nouvelle année pour l'équipe d'encadrement.",
      },
    ],

    leaders: [
      {
        name: "Fr. Aristide Yao",
        role: "Responsable Principal",
        description:
          "Éducateur de formation, il coordonne l'école du dimanche depuis six ans.",
      },
      {
        name: "Sr. Micheline Kouadio",
        role: "Responsable Adjointe",
        description:
          "Elle encadre les adolescents et veille au suivi personnel de chaque jeune.",
      },
    ],

    testimonials: [
      {
        message:
          "Mon fils attend le dimanche avec impatience. Il récite ses versets à la maison et prie pour la famille.",
        author: "Mme Adjoua T.",
        rating: 5,
      },
      {
        message:
          "J'ai rejoint le groupe des jeunes à 13 ans. C'est ici que j'ai appris à lire ma Bible seul.",
        author: "Yannick K.",
        rating: 5,
      },
    ],
  },

  "louange-adoration": {
    slug: "louange-adoration",

    title: "Louange & Adoration",

    description:
      "Élever un son qui transforme les cœurs et attire la présence de Dieu.",

    image: "/images/ministries/louange-hero.jpg",

    color: "gold",

    mission: {
      title: "Notre Mission",
      description:
        "Conduire l'Église dans une adoration authentique et profonde qui glorifie Dieu et transforme des vies.",
    },

    vision: {
      title: "Notre Vision",
      description:
        "Voir chaque cœur connecté à Dieu à travers une adoration sincère et puissante, portée par des musiciens formés et consacrés.",
    },

    stats: [
      { icon: "users", value: "150+", label: "Membres actifs" },
      { icon: "calendar", value: "12", label: "Activités mensuelles" },
      { icon: "leaders", value: "8", label: "Responsables" },
      { icon: "star", value: "5 ans", label: "D'existence" },
    ],

    gallery: [
      worshipImg,
      event1Img,
      event3Img,
      event5Img,
      event2Img,
      event4Img,
    ],

    events: [
      {
        day: "15",
        month: "Juin",
        title: "Retraite spirituelle",
        time: "08h00 - 17h00",
        location: "Centre de prière",
        description:
          "Une journée de jeûne, de prière et de consécration pour toute l'équipe.",
      },
      {
        day: "22",
        month: "Juin",
        title: "Formation des leaders",
        time: "09h00 - 13h00",
        location: "Salle des conférences",
        description:
          "Atelier sur la conduite de la louange et la préparation d'un set d'adoration.",
      },
      {
        day: "05",
        month: "Juillet",
        title: "Nuit d'adoration",
        time: "21h00 - 00h00",
        location: "Temple principal, Angré",
        description:
          "Une veillée ouverte à tous, entièrement consacrée à la louange.",
      },
    ],

    leaders: [
      {
        name: "Fr. Samuel Kouassi",
        role: "Responsable Principal",
        description:
          "Passionné par la présence de Dieu et le développement des adorateurs.",
      },
      {
        name: "Sr. Grace N'Guessan",
        role: "Responsable Adjointe",
        description:
          "Coordonne les équipes et veille à la croissance spirituelle des membres.",
      },
    ],

    testimonials: [
      {
        message:
          "Ce ministère a transformé ma vie et m'a appris à adorer Dieu en esprit et en vérité.",
        author: "Sarah K.",
        rating: 5,
      },
      {
        message:
          "J'ai trouvé une véritable famille spirituelle et je grandis chaque jour.",
        author: "David A.",
        rating: 5,
      },
    ],
  },

  enseignement: {
    slug: "enseignement",

    title: "Enseignement",

    description:
      "La parole de Dieu enseignée avec clarté pour une vie transformée.",

    image: "/images/ministries/enseignement.jpg",

    color: "green",

    mission: {
      title: "Notre Mission",
      description:
        "Enseigner les Écritures avec fidélité et simplicité, afin que chaque membre puisse comprendre la Bible, l'appliquer et la transmettre à son tour.",
    },

    vision: {
      title: "Notre Vision",
      description:
        "Une Église solidement enracinée dans la saine doctrine, capable de rendre compte de son espérance avec assurance et douceur.",
    },

    stats: [
      { icon: "users", value: "220+", label: "Participants" },
      { icon: "calendar", value: "10", label: "Sessions mensuelles" },
      { icon: "leaders", value: "6", label: "Enseignants" },
      { icon: "star", value: "7 ans", label: "D'existence" },
    ],

    gallery: [
      teachingImg,
      bibleImg,
      event3Img,
      event1Img,
      event4Img,
      event2Img,
    ],

    events: [
      {
        day: "12",
        month: "Juin",
        title: "École biblique du mercredi",
        time: "18h30 - 20h00",
        location: "Salle des conférences",
        description:
          "Étude verset par verset de l'Épître aux Romains, ouverte à tous.",
      },
      {
        day: "28",
        month: "Juin",
        title: "Séminaire : fondements de la foi",
        time: "09h00 - 15h00",
        location: "Temple principal, Angré",
        description:
          "Deux jours pour poser les bases essentielles de la vie chrétienne.",
      },
      {
        day: "19",
        month: "Juillet",
        title: "Atelier d'herméneutique",
        time: "10h00 - 13h00",
        location: "Bibliothèque de l'église",
        description:
          "Apprendre à interpréter un texte biblique dans son contexte.",
      },
    ],

    leaders: [
      {
        name: "Pasteur Emmanuel Brou",
        role: "Responsable Principal",
        description:
          "Enseignant depuis quinze ans, il supervise le programme de l'école biblique.",
      },
      {
        name: "Fr. Ismaël Koffi",
        role: "Responsable Adjoint",
        description:
          "Anime les ateliers d'étude personnelle et accompagne les nouveaux convertis.",
      },
    ],

    testimonials: [
      {
        message:
          "Je lisais la Bible sans rien comprendre. Aujourd'hui, je prépare moi-même mes études pour mon groupe de maison.",
        author: "Patricia G.",
        rating: 5,
      },
      {
        message:
          "Les enseignements sont clairs et ancrés dans le texte. Ma foi repose enfin sur des bases solides.",
        author: "Jean-Marc D.",
        rating: 5,
      },
    ],
  },

  "groupes-de-maison": {
    slug: "groupes-de-maison",

    title: "Groupes de maison",

    description:
      "Vivre la foi en petits groupes, partager et s'encourager mutuellement.",

    image: "/images/ministries/homegroup.jpg",

    color: "gold",

    mission: {
      title: "Notre Mission",
      description:
        "Rapprocher l'Église du quotidien des membres en créant des cellules de proximité où l'on prie, étudie la Parole et prend soin les uns des autres.",
    },

    vision: {
      title: "Notre Vision",
      description:
        "Un groupe de maison dans chaque quartier d'Abidjan, pour que personne ne vive sa foi isolé.",
    },

    stats: [
      { icon: "users", value: "260+", label: "Membres en cellule" },
      { icon: "calendar", value: "16", label: "Rencontres mensuelles" },
      { icon: "leaders", value: "18", label: "Bergers de cellule" },
      { icon: "star", value: "6 ans", label: "D'existence" },
    ],

    gallery: [
      homegroupImg,
      familyImg,
      bibleImg,
      event2Img,
      event5Img,
      event3Img,
    ],

    events: [
      {
        day: "14",
        month: "Juin",
        title: "Rencontre inter-cellules",
        time: "16h00 - 19h00",
        location: "Cour de l'église, Angré",
        description:
          "Toutes les cellules se retrouvent pour un temps de louange et de partage.",
      },
      {
        day: "27",
        month: "Juin",
        title: "Formation des bergers",
        time: "09h00 - 12h00",
        location: "Salle des conférences",
        description:
          "Accompagnement pastoral et animation d'un groupe de maison.",
      },
      {
        day: "11",
        month: "Juillet",
        title: "Lancement de cellules à Cocody",
        time: "18h00 - 20h00",
        location: "Cocody, Riviera",
        description:
          "Ouverture de trois nouveaux groupes de maison sur la commune.",
      },
    ],

    leaders: [
      {
        name: "Fr. Rodrigue N'Dri",
        role: "Responsable Principal",
        description:
          "Coordonne l'ensemble des cellules et la formation des bergers.",
      },
      {
        name: "Sr. Estelle Bamba",
        role: "Responsable Adjointe",
        description:
          "Assure le suivi des nouveaux membres et l'ouverture des nouvelles cellules.",
      },
    ],

    testimonials: [
      {
        message:
          "Le groupe de maison de mon quartier est devenu ma seconde famille. On prie ensemble chaque semaine.",
        author: "Christelle A.",
        rating: 5,
      },
      {
        message:
          "Après mon déménagement, j'ai retrouvé une cellule à dix minutes de chez moi. Je ne me suis jamais senti seul.",
        author: "Boris K.",
        rating: 5,
      },
    ],
  },

  "action-sociale": {
    slug: "action-sociale",

    title: "Action Sociale",

    description:
      "Manifester l'amour de Christ par des actions concrètes envers notre prochain.",

    image: "/images/ministries/sociale.jpg",

    color: "green",

    mission: {
      title: "Notre Mission",
      description:
        "Traduire l'Évangile en gestes concrets : assister les familles vulnérables, soutenir les veuves et les orphelins, et servir notre communauté sans distinction.",
    },

    vision: {
      title: "Notre Vision",
      description:
        "Être une église connue dans son quartier pour sa compassion, où personne autour de nous ne manque de l'essentiel.",
    },

    stats: [
      { icon: "users", value: "90+", label: "Bénévoles" },
      { icon: "calendar", value: "6", label: "Actions mensuelles" },
      { icon: "leaders", value: "5", label: "Responsables" },
      { icon: "star", value: "4 ans", label: "D'existence" },
    ],

    gallery: [
      socialImg,
      familyImg,
      event4Img,
      event2Img,
      event5Img,
      event1Img,
    ],

    events: [
      {
        day: "08",
        month: "Juin",
        title: "Distribution de vivres",
        time: "08h00 - 12h00",
        location: "Quartier Nouveau",
        description:
          "Remise de kits alimentaires aux familles identifiées par les cellules.",
      },
      {
        day: "29",
        month: "Juin",
        title: "Consultation médicale gratuite",
        time: "08h00 - 15h00",
        location: "Cour de l'église, Angré",
        description:
          "Journée santé animée par les professionnels de santé de l'église.",
      },
      {
        day: "26",
        month: "Juillet",
        title: "Rentrée scolaire solidaire",
        time: "09h00 - 14h00",
        location: "Salle polyvalente",
        description:
          "Distribution de fournitures scolaires aux enfants des familles aidées.",
      },
    ],

    leaders: [
      {
        name: "Sr. Mariam Touré",
        role: "Responsable Principale",
        description:
          "Assistante sociale, elle pilote les actions d'aide aux familles vulnérables.",
      },
      {
        name: "Fr. Serge Gbagbo",
        role: "Responsable Adjoint",
        description:
          "Organise la logistique des collectes et le suivi des bénéficiaires.",
      },
    ],

    testimonials: [
      {
        message:
          "Quand j'ai perdu mon emploi, l'église a soutenu ma famille pendant trois mois sans jamais me faire sentir jugée.",
        author: "Akissi N.",
        rating: 5,
      },
      {
        message:
          "Servir dans ce ministère m'a ouvert les yeux. Donner de mon temps est devenu une joie.",
        author: "Olivier T.",
        rating: 5,
      },
    ],
  },

  evangelisation: {
    slug: "evangelisation",

    title: "Évangélisation",

    description:
      "Annoncer l'Évangile et gagner des âmes pour le Royaume de Dieu.",

    image: "/images/ministries/evangelisation.jpg",

    color: "gold",

    mission: {
      title: "Notre Mission",
      description:
        "Sortir des murs de l'église pour annoncer la bonne nouvelle dans les quartiers, les marchés et les campus, et accompagner chaque nouveau croyant.",
    },

    vision: {
      title: "Notre Vision",
      description:
        "Que chaque membre de CAVA sache partager sa foi simplement, et qu'aucun quartier d'Abidjan ne reste sans témoignage.",
    },

    stats: [
      { icon: "users", value: "120+", label: "Évangélistes" },
      { icon: "calendar", value: "9", label: "Sorties mensuelles" },
      { icon: "leaders", value: "7", label: "Responsables" },
      { icon: "star", value: "8 ans", label: "D'existence" },
    ],

    gallery: [
      evangelismImg,
      event5Img,
      event3Img,
      event1Img,
      bibleImg,
      event4Img,
    ],

    events: [
      {
        day: "05",
        month: "Juin",
        title: "Journée d'évangélisation",
        time: "08h00 - 16h00",
        location: "Quartier Nouveau",
        description:
          "Sortie porte-à-porte suivie d'un temps de prière pour les malades.",
      },
      {
        day: "20",
        month: "Juin",
        title: "Campagne sur les campus",
        time: "10h00 - 15h00",
        location: "Université de Cocody",
        description:
          "Rencontres et témoignages auprès des étudiants d'Abidjan.",
      },
      {
        day: "12",
        month: "Juillet",
        title: "Formation à l'évangélisation",
        time: "09h00 - 12h00",
        location: "Salle des conférences",
        description:
          "Apprendre à partager sa foi avec clarté, respect et assurance.",
      },
    ],

    leaders: [
      {
        name: "Fr. Léonce Adou",
        role: "Responsable Principal",
        description:
          "Coordonne les sorties d'évangélisation et le suivi des nouveaux convertis.",
      },
      {
        name: "Sr. Bénédicte Yapo",
        role: "Responsable Adjointe",
        description:
          "Forme les équipes et anime les campagnes en milieu étudiant.",
      },
    ],

    testimonials: [
      {
        message:
          "C'est lors d'une sortie au marché que j'ai entendu l'Évangile pour la première fois. Deux ans après, je sers dans cette même équipe.",
        author: "Franck Z.",
        rating: 5,
      },
      {
        message:
          "J'avais peur de parler de ma foi. La formation m'a donné les mots et l'assurance.",
        author: "Nadège S.",
        rating: 5,
      },
    ],
  },
};

export default ministries;
