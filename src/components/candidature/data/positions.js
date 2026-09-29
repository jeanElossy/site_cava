// Postes ouverts de l'appel à candidatures.
//
// Écrits en dur, et pas lus de la base : ce ne sont PAS les ministères
// (`content/ministries.json`, six entrées publiques déjà administrables
// depuis /admin). Un ministère est une activité permanente de l'Église ;
// un poste ouvert est une campagne de recrutement, avec ses propres
// intitulés et sa propre durée de vie. Les confondre aurait rattaché
// « Finance & Administration » ou « Secrétariat exécutif » — qui ne sont
// pas des ministères — aux pages publiques /ministries/:slug.
//
// Quand la campagne changera, c'est ce fichier qu'on modifie. S'il faut
// un jour l'administrer depuis /admin, ce tableau devient une ressource
// en base et ce module son adaptateur, comme
// `MinistryDetails/data/ministries.js` l'a fait.
//
// `id` sert au préremplissage du formulaire par l'URL
// (`/appel-a-candidature?poste=<id>`) : un identifiant stable, pas
// l'intitulé, qui lui peut être réécrit sans casser les liens partagés.
//
// `variant` reprend l'alternance de la maquette (vert clair, jaune,
// vert foncé) : c'est un choix d'habillage, il n'a pas de sens métier.
const positions = [
  {
    id: "ifip-vie",
    title: "IFIP.VIE",
    subtitle: "Futurs formateurs",
    variant: "light",
    icon: "graduation",
  },
  {
    id: "delivrance",
    title: "Délivrance",
    subtitle: "Futurs serviteurs",
    variant: "gold",
    icon: "prayer",
  },
  {
    id: "bergeries",
    title: "Bergeries",
    subtitle: "Coordinateur des bergeries",
    variant: "dark",
    icon: "flock",
  },
  {
    id: "direction-des-cultes",
    title: "Direction des cultes",
    subtitle: "Futurs serviteurs",
    variant: "gold",
    icon: "worship",
  },
  {
    id: "finance-administration",
    title: "Finance & Administration",
    subtitle: "Équipe à constituer",
    variant: "dark",
    icon: "finance",
  },
  {
    id: "secretariat-executif",
    title: "Secrétariat exécutif",
    subtitle: "Équipe à constituer",
    variant: "light",
    icon: "secretariat",
  },
];

export const findPosition = (id) =>
  positions.find((position) => position.id === id);

export default positions;
