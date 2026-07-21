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
          type: "paragraph",
          text: "Le site public est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis. Contact : vercel.com/support.",
        },
        {
          type: "paragraph",
          text: "Plusieurs autres prestataires interviennent dans le fonctionnement du site :",
        },
        {
          type: "list",
          items: [
            "Render Services, Inc. (États-Unis) — hébergement de l'interface d'administration et du service applicatif.",
            "MongoDB, Inc. (États-Unis) — base de données, via le service MongoDB Atlas.",
            "Cloudinary Ltd. (Israël / États-Unis) — stockage et diffusion des images et fichiers publiés depuis l'administration.",
          ],
        },
        {
          type: "paragraph",
          text: "Ces prestataires étant établis hors de Côte d'Ivoire, les données transitent et sont conservées à l'étranger.",
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
          type: "paragraph",
          text: "État exact des formulaires en production à ce jour :",
        },
        {
          type: "list",
          items: [
            "Formulaire de contact — seul formulaire qui transmet et conserve réellement des données. Champs enregistrés : nom, adresse e-mail, sujet, message, et accord de recontact.",
            "Formulaire d'inscription à la lettre d'information (pied de page) — n'est pas encore relié à un service d'envoi : aucune adresse n'est actuellement transmise ni conservée.",
            "Formulaire de contribution (page Don) — aucun paiement en ligne n'est traité à ce jour, et aucune coordonnée bancaire n'est collectée ni transmise.",
          ],
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
          type: "paragraph",
          text: "Le texte de référence en Côte d'Ivoire est la loi n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel.",
        },
        {
          type: "placeholder",
          label:
            "Faire vérifier par un juriste que cette référence est bien celle applicable, et qu'aucun texte plus récent ne la complète ou ne la remplace",
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
          type: "paragraph",
          text: "Messages reçus via le formulaire de contact : conservés 24 mois à compter de leur réception, puis supprimés automatiquement. Cette suppression est appliquée par la base de données elle-même, sans intervention manuelle.",
        },
        {
          type: "paragraph",
          text: "Adresses e-mail de la lettre d'information : aucune conservation à ce jour, puisque le formulaire n'est pas encore relié à un service d'envoi et ne transmet aucune adresse. Cette mention devra être mise à jour dès sa mise en service.",
        },
        {
          type: "paragraph",
          text: "Informations liées aux contributions et aux dons : aucune conservation à ce jour, aucun paiement en ligne n'étant traité. Les dons se font par les moyens indiqués sur la page dédiée, hors du site.",
        },
        {
          type: "paragraph",
          text: "Journal technique des connexions à l'espace d'administration (date, adresse IP, action effectuée) : conservé 12 mois, à des fins de sécurité, puis supprimé automatiquement.",
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
            "Faire valider cette liste par le responsable de la publication avant mise en ligne définitive",
        },
        {
          type: "paragraph",
          text: "À ce jour, les prestataires techniques susceptibles d'accéder aux données sont les suivants :",
        },
        {
          type: "list",
          items: [
            "Vercel Inc. — hébergement du site public.",
            "Render Services, Inc. — hébergement du service applicatif et de l'espace d'administration.",
            "MongoDB, Inc. — base de données hébergée (messages du formulaire de contact, contenus du site).",
            "Cloudinary Ltd. — stockage des images et fichiers publiés depuis l'administration.",
          ],
        },
        {
          type: "paragraph",
          text: "Aucun prestataire d'envoi d'e-mails ni prestataire de paiement n'intervient à ce jour : ni la lettre d'information, ni le paiement en ligne ne sont en service. Aucune donnée n'est vendue, louée ni cédée à des tiers à des fins commerciales.",
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
          type: "paragraph",
          text: "Ce site n'installe aucun cookie de mesure d'audience, aucun traceur publicitaire et aucun outil de suivi comportemental. Ni Google Analytics, ni aucun équivalent, n'y est intégré.",
        },
        {
          type: "paragraph",
          text: "Aucun consentement aux cookies ne vous est donc demandé : il n'y a rien à consentir. Cette absence est vérifiable — la politique de sécurité du site interdit techniquement le chargement de tout script provenant d'un autre domaine.",
        },
        {
          type: "paragraph",
          text: "Le seul stockage effectué dans votre navigateur concerne l'espace d'administration, réservé à l'équipe de l'église : il y conserve le jeton de session de la personne connectée. Aucun visiteur du site public n'est concerné.",
        },
        {
          type: "paragraph",
          text: "Les pages contenant une vidéo YouTube utilisent le domaine youtube-nocookie.com, qui ne dépose pas de traceur publicitaire tant que la lecture n'est pas lancée.",
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
          type: "paragraph",
          text: "L'autorité de contrôle compétente en Côte d'Ivoire est l'ARTCI (Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire), auprès de laquelle toute réclamation relative au traitement de vos données peut être introduite.",
        },
        {
          type: "placeholder",
          label:
            "Confirmer auprès de l'ARTCI ses coordonnées actuelles et la procédure de réclamation en vigueur",
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
          type: "paragraph",
          text: "Dernière mise à jour de la présente politique de confidentialité : 21 juillet 2026.",
        },
      ],
    },
  ],
};
