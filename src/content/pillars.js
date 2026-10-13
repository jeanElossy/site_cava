import ecoleImage from "../assets/images/pillars/ecole.jpg";
import armeeImage from "../assets/images/pillars/armee.jpg";
import familleImage from "../assets/images/pillars/famille.jpg";
import entrepriseImage from "../assets/images/pillars/entreprise.jpg";

// Les quatre piliers de ÇA.VA., textes fournis par l'église (13/10/2026).
//
// SOURCE UNIQUE : la section « Nos piliers » de la page À propos
// (`AboutPillars`) et la page de détail (`/piliers/:slug`) lisent toutes
// deux ce fichier. Ne pas recopier ces textes ailleurs.
//
// Contenu statique, versionné : il n'est pas (encore) administrable
// depuis /admin. Il est rendu comme du texte par React, jamais comme du
// HTML — aucune balise saisie ici ne serait interprétée.
//
// Photos : recadrages portrait (720 × 900) importés depuis `src/assets`,
// donc vérifiés au build et servis par le site lui-même (aucun domaine
// tiers dans la CSP). École et Armée viennent des images du site ;
// Famille (Pexels, photo 33134547) et Entreprise (Pexels, 30688596) sont
// des photos libres de droits sous licence Pexels.

export const PILLARS = [
  {
    slug: "ecole",
    name: "École",
    title: "L'École",
    image: ecoleImage,
    alt: "Un groupe d'étude biblique autour d'une Bible ouverte",
    verbs: ["Former", "Enseigner", "Transformer"],
    summary:
      "La dimension formative de ÇA.VA. : enseignement biblique, discipolat, formation des serviteurs et des responsables.",
    definition: [
      "Le pilier École représente toute la dimension formative de ÇA.VA.",
      "Il concerne l'enseignement biblique, le discipolat, la formation des serviteurs, le développement des responsables, la transmission de la doctrine et l'accompagnement des croyants vers la maturité spirituelle.",
    ],
    statement:
      "À travers ce pilier, ÇA.VA. affirme qu'une Église forte est une Église qui forme.",
    vision:
      "Conduire chaque croyant à grandir dans la connaissance de Dieu, à être transformé par la Parole et le Saint-Esprit, et à devenir un disciple mature, stable et utile dans le Royaume de Dieu.",
    objectives: [
      "Enseigner fidèlement la Parole de Dieu",
      "Établir les croyants dans les fondements de la foi",
      "Développer une culture de discipline spirituelle",
      "Former les serviteurs avant leur mise en fonction",
      "Préparer les responsables et les leaders",
      "Transmettre la vision de ÇA.VA.",
      "Favoriser la croissance doctrinale, spirituelle et pratique des membres",
    ],
    structures: [
      "L'École de la Foi : Grandir en Christ",
      "L'Institut de Formation Intégrale Parole de Vie",
      "L'École Biblique",
      "L'École des Bergers",
      "L'École Pastorale",
      "L'École Entrepreneuriale",
      "L'École Alphabétique",
      "Les formations ministérielles",
      "Les formations fonctionnelles",
      "Les modules de préparation au service",
    ],
    application: {
      lead: "À ÇA.VA., personne ne devrait servir durablement sans être formé.",
      paragraphs: [
        "La formation n'est pas une option, mais un principe de gouvernance. Elle permet de préserver la doctrine, de transmettre la vision, d'éviter l'improvisation et de préparer une relève fidèle.",
      ],
      priority:
        "Le pilier École soutient directement la priorité ministérielle : former des disciples matures.",
    },
  },
  {
    slug: "armee",
    name: "Armée",
    title: "L'Armée",
    image: armeeImage,
    alt: "Une foule en louange, les mains levées vers une croix lumineuse",
    verbs: ["Mobiliser", "Discipliner", "Envoyer"],
    summary:
      "La dimension de mobilisation, de discipline, de combat spirituel, d'engagement missionnaire et d'envoi.",
    definition: [
      "Le pilier Armée représente la dimension de mobilisation, de discipline, de combat spirituel, d'engagement missionnaire et d'envoi.",
    ],
    statement:
      "Il rappelle que l'Église n'est pas seulement une communauté qui reçoit, mais aussi un peuple mobilisé pour servir, prier, évangéliser, combattre spirituellement et avancer dans la mission.",
    vision:
      "Former des croyants disponibles, disciplinés, courageux et engagés, capables de servir Dieu avec persévérance, de porter les fardeaux spirituels de l'Église et de participer activement à l'avancement du Royaume.",
    objectives: [
      "Mobiliser les membres pour le service",
      "Développer une culture de prière et d'intercession",
      "Encourager l'évangélisation",
      "Préparer des serviteurs disciplinés",
      "Développer le sens de l'engagement",
      "Soutenir les combats spirituels de l'Église",
      "Envoyer les croyants dans la mission",
    ],
    structures: [
      "Le Ministère d'Intercession",
      "Le Ministère d'Évangélisation",
      "Le Ministère de Délivrance",
      "La Croisade des Intercesseurs",
      "Les équipes missionnaires",
      "Les équipes de service",
      "Les temps de jeûne et de prière",
      "Les programmes de mobilisation spirituelle",
    ],
    application: {
      lead: "À ÇA.VA., le croyant n'est pas appelé à demeurer spectateur. Il est appelé à être formé, mobilisé et envoyé.",
      paragraphs: [
        "Le pilier Armée développe une mentalité de responsabilité spirituelle. Il rappelle que la vie chrétienne implique engagement, discipline, persévérance et disponibilité.",
      ],
      priority:
        "Ce pilier soutient directement les priorités ministérielles : gagner des âmes, restaurer les vies et impacter la société.",
    },
  },
  {
    slug: "famille",
    name: "Famille",
    title: "La Famille",
    image: familleImage,
    alt: "Un père, une mère et leur petite fille, souriants",
    verbs: ["Aimer", "Soutenir", "Restaurer"],
    summary:
      "La dimension relationnelle, pastorale, sociale et communautaire de ÇA.VA.",
    definition: [
      "Le pilier Famille représente la dimension relationnelle, pastorale, sociale et communautaire de ÇA.VA.",
    ],
    statement:
      "Il rappelle que l'Église n'est pas seulement une institution ou une armée spirituelle ; elle est aussi une famille où les personnes sont aimées, connues, accompagnées, soutenues et restaurées.",
    vision:
      "Bâtir une communauté spirituelle dans laquelle chaque personne est accueillie avec amour, accompagnée avec sagesse, soutenue dans ses difficultés et conduite vers la restauration et la maturité en Christ.",
    objectives: [
      "Développer une culture d'accueil et d'appartenance",
      "Accompagner les nouvelles âmes",
      "Assurer le suivi pastoral des membres",
      "Soutenir les personnes vulnérables",
      "Favoriser la communion fraternelle",
      "Restaurer les relations et les vies",
      "Intégrer chaque personne dans une bergerie",
    ],
    structures: [
      "La C.A.N.A.",
      "Les Bergeries",
      "Le Corps des Bergers",
      "La Commission Sociale",
      "Le ministère des Femmes",
      "Le ministère de la Jeunesse",
      "Le ministère des Enfants",
      "L'accompagnement pastoral",
      "Les visites",
      "Les actions sociales",
    ],
    application: {
      lead: "À ÇA.VA., aucune âme ne doit marcher seule.",
      paragraphs: [
        "Le pilier Famille donne un visage pastoral à l'Église. Il permet que les personnes ne soient pas seulement comptées, mais connues ; pas seulement accueillies, mais accompagnées ; pas seulement présentes, mais intégrées.",
      ],
      priority:
        "Ce pilier soutient directement les priorités ministérielles : accompagner, restaurer, former et intégrer.",
    },
  },
  {
    slug: "entreprise",
    name: "Entreprise",
    title: "L'Entreprise",
    image: entrepriseImage,
    alt: "Une équipe en réunion autour d'une table de bureau",
    verbs: ["Gérer", "Structurer", "Développer"],
    summary:
      "La dimension organisationnelle, administrative, financière, stratégique et développementale de ÇA.VA.",
    definition: [
      "Le pilier Entreprise représente la dimension organisationnelle, administrative, financière, stratégique et développementale de ÇA.VA.",
    ],
    statement:
      "Il ne signifie pas que l'Église est une entreprise commerciale. Il signifie que l'œuvre de Dieu doit être gérée avec sérieux, sagesse, ordre, planification, redevabilité et excellence.",
    vision:
      "Assurer une gouvernance saine, une administration responsable et une organisation efficace, afin que les ressources confiées à l'Église servent fidèlement l'accomplissement de la vision.",
    objectives: [
      "Structurer le fonctionnement de l'Église",
      "Clarifier les responsabilités",
      "Assurer une gestion transparente des ressources",
      "Développer une culture de rapports et de redevabilité",
      "Planifier les actions de l'Église",
      "Suivre et évaluer les résultats",
      "Préserver les documents institutionnels",
      "Accompagner le développement durable de ÇA.VA.",
    ],
    structures: [
      "Le Secrétariat Exécutif",
      "La Commission Finances et Administration",
      "La Commission Organisation",
      "La Cellule Communication et Médias",
      "La Cellule Protocole et Sécurité",
      "Le Secrétariat particulier du Pasteur",
      "Les procédures administratives",
      "Les rapports",
      "Les tableaux de bord",
      "La planification stratégique",
    ],
    application: {
      lead: "À ÇA.VA., l'organisation n'est pas opposée à la spiritualité.",
      paragraphs: [
        "Une Église conduite par le Saint-Esprit peut aussi être bien organisée, bien administrée et bien structurée.",
        "Le pilier Entreprise garantit que la vision ne repose pas uniquement sur l'inspiration, mais aussi sur des systèmes capables de la porter, de la protéger et de la transmettre.",
      ],
      priority:
        "Ce pilier soutient directement la priorité ministérielle : développer des leaders et assurer un impact durable.",
    },
  },
];

/**
 * Pilier correspondant à un slug d'URL, ou `null`. Recherche dans la
 * liste et non par indexation d'objet : un slug comme « constructor »
 * ne peut pas remonter une propriété héritée du prototype.
 */
export const findPillar = (slug) =>
  PILLARS.find((pillar) => pillar.slug === slug) ?? null;

export const pillarPath = (slug) => `/piliers/${slug}`;
