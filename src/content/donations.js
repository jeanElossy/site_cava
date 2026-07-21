import stored from "./donations.json";

// Chiffres de la collecte, agrégés en base au moment du build.
//
// ------------------------------------------------------------------
// POURQUOI CES CHIFFRES ONT REMPLACÉ LES PRÉCÉDENTS
// ------------------------------------------------------------------
// La page affichait jusqu'ici « 18,5 M FCFA collectés », « 1 284
// contributeurs », « 12 projets réalisés » — des valeurs de maquette,
// jamais mises à jour. Une autre section de la même page en annonçait
// « +2 000 » et « +15 » : deux chiffres différents pour la même
// réalité, sur un même écran.
//
// Sur une page qui demande de l'argent, ce n'est pas un détail de
// présentation. Un visiteur qui donne parce que « 18,5 M ont déjà été
// collectés » décide sur la foi d'un chiffre inventé.
//
// Ces valeurs viennent désormais des dons réellement encaissés.
//
// ------------------------------------------------------------------
// ET TANT QU'IL N'Y A RIEN À MONTRER
// ------------------------------------------------------------------
// La section disparaît. « 0 FCFA collecté » sur une page de don
// découragerait plus sûrement que l'absence de chiffres, et un total
// de quelques milliers de francs le premier mois n'est pas un argument
// non plus. Le seuil laisse à la collecte le temps d'exister.

const MIN_COLLECTED = 100000;
const MIN_CONTRIBUTIONS = 10;

const value = (raw) => (Number.isFinite(raw) && raw > 0 ? raw : 0);

const collected = value(stored.collected);
const contributions = value(stored.contributions);

export const donationStats = {
  collected,
  contributions,
  projects: value(stored.projects),

  // Un seul verrou pour toute la section : afficher le nombre de
  // contributions sans le total (ou l'inverse) donnerait une image
  // partielle, plus trompeuse que pas d'image du tout.
  visible:
    collected >= MIN_COLLECTED && contributions >= MIN_CONTRIBUTIONS,
};

export default donationStats;
