/* ==========================================================
   Contenu des pages légales.

   IMPORTANT
   Les blocs de type "placeholder" signalent une information
   juridique ou factuelle qui NE DOIT PAS être inventée.
   Elle doit être renseignée par l'église avant toute mise
   en ligne publique du site.
========================================================== */

export const legalNotice = {
  title: "Mentions légales",

  intro:
    "Conformément aux usages en matière de communication en ligne, les informations ci-dessous précisent l'identité de l'éditeur du site, son hébergeur et les conditions d'utilisation du contenu publié.",

  sections: [
    {
      id: "editeur",
      title: "1. Éditeur du site",

      blocks: [
        {
          type: "paragraph",
          text: "Le présent site est édité par le Centre Apostolique Vie et Abondance (CAVA), communauté religieuse implantée à Abidjan, en Côte d'Ivoire.",
        },
        {
          type: "placeholder",
          label:
            "Dénomination juridique exacte de la structure éditrice",
        },
        {
          type: "placeholder",
          label:
            "Statut juridique (association, congrégation religieuse, autre)",
        },
        {
          type: "placeholder",
          label:
            "Numéro d'enregistrement officiel (RCCM, récépissé de déclaration ou équivalent)",
        },
        {
          type: "placeholder",
          label:
            "Adresse postale complète du siège (commune, quartier, rue, BP)",
        },
        {
          type: "placeholder",
          label:
            "Numéro de téléphone officiel à publier",
        },
        {
          type: "placeholder",
          label: "Adresse e-mail officielle à publier",
        },
      ],
    },

    {
      id: "publication",
      title: "2. Responsable de la publication",

      blocks: [
        {
          type: "paragraph",
          text: "Le responsable de la publication est la personne physique désignée par la direction de l'église pour assumer la responsabilité éditoriale des contenus diffusés sur ce site.",
        },
        {
          type: "placeholder",
          label:
            "Nom, prénom et fonction du responsable de la publication",
        },
        {
          type: "placeholder",
          label:
            "Adresse e-mail de contact du responsable de la publication",
        },
      ],
    },

    {
      id: "hebergement",
      title: "3. Hébergement",

      blocks: [
        {
          type: "paragraph",
          text: "Le site est hébergé par un prestataire technique tiers, qui assure la mise à disposition des contenus au public.",
        },
        {
          type: "placeholder",
          label: "Nom ou raison sociale de l'hébergeur",
        },
        {
          type: "placeholder",
          label: "Adresse postale de l'hébergeur",
        },
        {
          type: "placeholder",
          label:
            "Numéro de téléphone ou moyen de contact de l'hébergeur",
        },
      ],
    },

    {
      id: "propriete",
      title: "4. Propriété intellectuelle",

      blocks: [
        {
          type: "paragraph",
          text: "L'ensemble des éléments composant ce site — structure, textes, logo, illustrations, photographies, enregistrements audio et vidéo, éléments graphiques et mise en page — est la propriété de l'éditeur ou de ses partenaires, sauf mention contraire explicite.",
        },
        {
          type: "paragraph",
          text: "Toute reproduction, représentation, adaptation ou diffusion, totale ou partielle, sur quelque support que ce soit, est interdite sans autorisation écrite préalable de l'éditeur.",
        },
        {
          type: "paragraph",
          text: "Le partage d'un lien vers une page du site, ainsi que la citation courte accompagnée de la mention de la source, restent libres.",
        },
      ],
    },

    {
      id: "credits",
      title: "5. Crédits",

      blocks: [
        {
          type: "paragraph",
          text: "Les contenus visuels et sonores publiés sur ce site proviennent des activités de l'église ou de sources dont l'éditeur détient les droits d'utilisation.",
        },
        {
          type: "placeholder",
          label:
            "Crédits photographiques et vidéo (auteurs, banques d'images utilisées)",
        },
        {
          type: "placeholder",
          label:
            "Conception et réalisation du site (nom du prestataire ou de l'équipe)",
        },
      ],
    },

    {
      id: "contenu",
      title: "6. Responsabilité sur le contenu",

      blocks: [
        {
          type: "paragraph",
          text: "L'éditeur apporte le plus grand soin à l'exactitude des informations publiées, notamment les horaires de cultes, les dates d'événements et les coordonnées de contact. Ces informations sont toutefois susceptibles d'évoluer.",
        },
        {
          type: "paragraph",
          text: "L'éditeur ne saurait être tenu responsable d'une interruption temporaire du service, d'une erreur ponctuelle ou d'un dommage résultant de l'utilisation des informations publiées.",
        },
      ],
    },

    {
      id: "liens",
      title: "7. Liens externes",

      blocks: [
        {
          type: "paragraph",
          text: "Ce site peut renvoyer vers des sites tiers, notamment les réseaux sociaux de l'église. L'éditeur n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu et à leurs pratiques en matière de données personnelles.",
        },
      ],
    },

    {
      id: "contact-legal",
      title: "8. Nous contacter",

      blocks: [
        {
          type: "paragraph",
          text: "Pour toute question relative aux présentes mentions légales, à un contenu publié ou à une demande de retrait, vous pouvez écrire à l'adresse de contact indiquée ci-dessous.",
        },
        {
          type: "placeholder",
          label:
            "Adresse e-mail dédiée aux demandes légales et aux signalements",
        },
      ],
    },
  ],
};

export const privacyPolicy = {
  title: "Politique de confidentialité",

  intro:
    "Cette politique explique quelles données personnelles sont collectées lorsque vous utilisez ce site, pourquoi elles le sont, combien de temps elles sont conservées et quels droits vous pouvez exercer.",

  sections: [
    {
      id: "principes",
      title: "1. Notre approche",

      blocks: [
        {
          type: "paragraph",
          text: "Le Centre Apostolique Vie et Abondance ne collecte que les données strictement nécessaires au fonctionnement du site et à la relation avec les personnes qui le sollicitent. Aucune donnée n'est vendue ni louée à des tiers.",
        },
      ],
    },

    {
      id: "donnees",
      title: "2. Données collectées",

      blocks: [
        {
          type: "paragraph",
          text: "Selon les actions que vous effectuez sur le site, les données suivantes peuvent être collectées :",
        },
        {
          type: "list",
          items: [
            "Formulaire de contact : nom, adresse e-mail, numéro de téléphone et contenu du message.",
            "Inscription à la newsletter : adresse e-mail.",
            "Formulaire de contribution ou de don : nom, coordonnées et informations nécessaires au traitement de la contribution.",
            "Données techniques transmises automatiquement par votre navigateur lors de la consultation des pages.",
          ],
        },
        {
          type: "paragraph",
          text: "Aucune donnée sensible n'est demandée. Vous n'êtes jamais tenu de renseigner un champ facultatif pour consulter le site.",
        },
        {
          type: "placeholder",
          label:
            "Confirmer la liste exacte des formulaires actifs et des champs réellement collectés en production",
        },
      ],
    },

    {
      id: "finalites",
      title: "3. Pourquoi ces données sont utilisées",

      blocks: [
        {
          type: "list",
          items: [
            "Répondre aux messages et demandes d'information adressés à l'église.",
            "Envoyer, sur demande explicite, les actualités et communications de l'église.",
            "Assurer le suivi et la traçabilité des contributions et dons.",
            "Maintenir la sécurité et le bon fonctionnement technique du site.",
          ],
        },
        {
          type: "paragraph",
          text: "Vos données ne sont utilisées pour aucune autre finalité sans votre accord préalable.",
        },
      ],
    },

    {
      id: "base-legale",
      title: "4. Fondement de la collecte",

      blocks: [
        {
          type: "paragraph",
          text: "La collecte repose principalement sur votre consentement, exprimé au moment où vous remplissez volontairement un formulaire, ainsi que sur l'intérêt légitime de l'église à répondre aux sollicitations qui lui sont adressées.",
        },
        {
          type: "placeholder",
          label:
            "Référence au texte de loi applicable en Côte d'Ivoire en matière de protection des données personnelles (à faire valider juridiquement)",
        },
      ],
    },

    {
      id: "conservation",
      title: "5. Durée de conservation",

      blocks: [
        {
          type: "paragraph",
          text: "Les données sont conservées pendant la durée nécessaire à la finalité pour laquelle elles ont été collectées, puis supprimées ou archivées.",
        },
        {
          type: "placeholder",
          label:
            "Durée de conservation des messages reçus via le formulaire de contact",
        },
        {
          type: "placeholder",
          label:
            "Durée de conservation des adresses e-mail de la newsletter",
        },
        {
          type: "placeholder",
          label:
            "Durée de conservation des informations liées aux contributions et dons",
        },
      ],
    },

    {
      id: "destinataires",
      title: "6. Qui accède à vos données",

      blocks: [
        {
          type: "paragraph",
          text: "L'accès aux données est limité aux personnes de l'église habilitées à traiter les demandes reçues, ainsi qu'aux prestataires techniques strictement nécessaires au fonctionnement du site.",
        },
        {
          type: "placeholder",
          label:
            "Liste des prestataires ayant accès aux données (hébergeur, outil d'envoi d'e-mails, prestataire de paiement)",
        },
      ],
    },

    {
      id: "cookies",
      title: "7. Cookies et mesure d'audience",

      blocks: [
        {
          type: "paragraph",
          text: "Un cookie est un petit fichier déposé sur votre appareil lors de la consultation d'un site. Seuls les cookies nécessaires au fonctionnement du site peuvent être déposés sans votre accord.",
        },
        {
          type: "paragraph",
          text: "Vous pouvez à tout moment configurer votre navigateur pour refuser les cookies ou supprimer ceux déjà enregistrés.",
        },
        {
          type: "placeholder",
          label:
            "Indiquer si un outil de mesure d'audience est réellement installé, et lequel — sinon, mentionner explicitement l'absence de traceur",
        },
      ],
    },

    {
      id: "securite",
      title: "8. Sécurité",

      blocks: [
        {
          type: "paragraph",
          text: "Des mesures techniques et organisationnelles raisonnables sont mises en œuvre pour protéger les données contre la perte, l'accès non autorisé et la divulgation. Aucune transmission sur Internet ne pouvant être garantie totalement sûre, une sécurité absolue ne peut cependant être promise.",
        },
      ],
    },

    {
      id: "droits",
      title: "9. Vos droits",

      blocks: [
        {
          type: "paragraph",
          text: "Vous disposez du droit d'accéder aux données vous concernant, de demander leur rectification ou leur suppression, de vous opposer à leur traitement et de retirer votre consentement à tout moment.",
        },
        {
          type: "paragraph",
          text: "Le désabonnement de la newsletter est possible à tout moment, sans justification.",
        },
        {
          type: "placeholder",
          label:
            "Adresse e-mail dédiée à l'exercice des droits sur les données personnelles",
        },
        {
          type: "placeholder",
          label:
            "Délai de réponse que l'église s'engage à respecter",
        },
        {
          type: "placeholder",
          label:
            "Autorité de contrôle compétente auprès de laquelle une réclamation peut être introduite (à confirmer)",
        },
      ],
    },

    {
      id: "mineurs",
      title: "10. Mineurs",

      blocks: [
        {
          type: "paragraph",
          text: "Les activités destinées aux enfants et aux adolescents font l'objet d'une attention particulière. Aucune donnée concernant un mineur n'est collectée en ligne sans l'accord d'un parent ou du représentant légal.",
        },
      ],
    },

    {
      id: "evolution",
      title: "11. Évolution de cette politique",

      blocks: [
        {
          type: "paragraph",
          text: "Cette politique peut être mise à jour pour tenir compte d'évolutions techniques, organisationnelles ou réglementaires. La version applicable est celle publiée sur cette page.",
        },
        {
          type: "placeholder",
          label:
            "Date de dernière mise à jour de la politique de confidentialité",
        },
      ],
    },
  ],
};
