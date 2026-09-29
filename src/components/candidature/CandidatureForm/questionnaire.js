// Contenu du questionnaire « Découvre ta place ».
//
// Séparé du composant : ce sont des LIBELLÉS, ils changeront au rythme
// de l'Église, pas à celui du code. Les modifier ici ne demande pas de
// relire la logique du formulaire.
//
// Les valeurs stockées sont les libellés eux-mêmes, et non des
// identifiants : la réponse finit dans le corps d'un message lu par un
// humain (/admin/messages), pas dans un modèle relationnel. Un
// identifiant obligerait à maintenir une table de correspondance pour
// rendre le message lisible.

export const SKILLS = [
  "Enseigner / former",
  "Accueillir / écouter / accompagner",
  "Évangéliser / témoigner",
  "Prier / intercéder",
  "Organiser / planifier",
  "Gérer / administrer",
  "Comptabilité / finances",
  "Communication / médias",
  "Informatique / numérique",
  "Musique / chant",
  "Travail avec les enfants",
  "Aide sociale / solidarité",
  "Entretien / travaux pratiques",
  "Entrepreneuriat / développement de projets",
];

export const SITUATIONS = [
  "Déjà engagé(e) dans un service",
  "Disponible pour servir",
  "Intéressé(e), mais j'ai besoin d'être orienté(e)",
  "J'aimerais d'abord être formé(e)",
  "Je ne sais pas encore où est ma place",
];

export const AVAILABILITIES = [
  "Régulièrement",
  "Ponctuellement",
  "Pour certains événements/projets",
  "À déterminer avec un responsable",
];

export const PRAYER =
  "Seigneur, montre-moi ma place, développe ce que tu as déposé en moi " +
  "et rends-moi utile à ce que tu bâtis dans cette maison.";
