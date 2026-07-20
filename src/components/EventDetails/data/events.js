// Source unique des événements du site.
//
// Elle remplace les deux listes qui coexistaient auparavant :
//  - `src/components/Events/Events.jsx`   (accueil)  → source de vérité
//  - `src/components/UpcomingEvents.jsx`  (/events)  → contenu de maquette
//
// À la demande du client, ce sont les événements de l'accueil qui font foi.
// Les entrées issues de la maquette (« Culte dominical », « Réunion de
// prière », « Soirée de louange », « École du dimanche - Spéciale »,
// « Conférence des leaders ») ont été retirées, pas fusionnées.
//
// Les deux composants lisent désormais ce fichier, ce qui garantit que
// chaque lien `/events/<slug>` correspond bien à une entrée existante.
//
// Modèle calqué sur `src/components/MinistryDetails/data/ministries.js`.

import event1Img from "../../../assets/images/event-1.jpg";
import event2Img from "../../../assets/images/event-2.jpg";
import event3Img from "../../../assets/images/event-3.jpg";

const events = {
  "culte-s-offrir-a-dieu": {
    slug: "culte-s-offrir-a-dieu",

    title: "Culte S'OFFRIR À DIEU",

    day: "15",
    month: "JUIN",
    date: "Dimanche 15 Juin 2025",
    dateLong: "Dimanche 15 Juin 2025 - 08:30",
    time: "08h30",
    endTime: "11h30",
    location: "CAVA, Abidjan",
    address: "Angré château, non loin de l'institut des jésuites",

    image: event1Img,
    color: "green",

    description:
      "Temps d'adoration, de prière et d'enseignement.",

    content: [
      "Un culte spécial placé sous le thème « S'offrir à Dieu ». Une invitation à remettre à Dieu non seulement nos activités, mais notre vie entière.",
      "La matinée articule un temps de louange conduit par l'équipe d'adoration, un message centré sur les Écritures, puis un moment de prière et de consécration personnelle.",
    ],

    audience: "Ouvert à tous",
  },

  "ecole-de-la-foi": {
    slug: "ecole-de-la-foi",

    title: "ÉCOLE DE LA FOI",

    day: "17",
    month: "JUIN",
    date: "Mercredi 17 Juin 2025",
    dateLong: "Mercredi 17 Juin 2025 - 18:30",
    time: "18h30",
    endTime: "20h30",
    location: "CAVA, Abidjan",
    address: "Angré château, non loin de l'institut des jésuites",

    image: event2Img,
    color: "yellow",

    description:
      "Formation biblique et croissance spirituelle.",

    content: [
      "L'École de la foi est le rendez-vous de formation de l'Église. On y apprend à lire, comprendre et appliquer les Écritures dans la vie quotidienne.",
      "Les sessions sont progressives : chacun peut rejoindre le cycle en cours, quel que soit son niveau de connaissance biblique.",
    ],

    audience: "Ouvert à tous",
  },

  "camp-de-formation-spirituelle": {
    slug: "camp-de-formation-spirituelle",

    title: "Camp de Formation Spirituelle",

    day: "27",
    month: "JUIN",
    date: "27 au 28 Juin 2025",
    dateLong: "27 au 28 Juin 2025 • 09h00 - 17h00",
    time: "09h00",
    endTime: "17h00",
    location: "CAVA, Abidjan",
    address: "Angré château, non loin de l'institut des jésuites",

    image: event3Img,
    color: "yellow",

    description:
      "Thème : Persévérer dans la discipline spirituelle • Orateur : Pasteur Israël Liaide",

    theme: "Persévérer dans la discipline spirituelle",

    speaker: {
      name: "Pasteur Israël Liaide",
      role: "Orateur invité",
      bio: "Il conduira l'ensemble des sessions d'enseignement du camp, sur le thème de la persévérance dans la discipline spirituelle.",
    },

    content: [
      "Deux journées de retraite pour approfondir sa vie avec Dieu, autour du thème « Persévérer dans la discipline spirituelle ».",
      "Le camp alterne enseignements, ateliers en petits groupes, temps de prière et moments de partage fraternel. Prévoyez de quoi prendre des notes.",
    ],

    audience: "Ouvert à tous",
  },
};

// Ordre d'affichage (chronologique), utilisé par l'accueil et la page /events.
export const eventsList = Object.values(events);

export default events;
