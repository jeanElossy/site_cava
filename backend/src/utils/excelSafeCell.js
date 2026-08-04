// Neutralise l'injection de formule Excel/CSV (souvent appelée
// « CSV injection » ou « formula injection »).
//
// Un champ texte libre (nom, téléphone…) peut contenir une valeur
// commençant par `=`, `+`, `-`, `@`, une tabulation ou un retour
// chariot — Excel et LibreOffice l'interprètent alors comme une
// formule à l'ouverture du fichier, pas comme du texte. Un visiteur
// mal intentionné saisissant un « nom » comme
// `=cmd|'/c calc'!A1` piégerait ainsi l'administrateur qui ouvre
// l'export, bien après que la donnée a été acceptée par l'API.
//
// La parade standard : préfixer d'une apostrophe toute valeur dont le
// premier caractère déclencherait une formule. Excel affiche alors le
// texte tel quel, apostrophe comprise dans la barre de formule mais
// jamais dans la cellule affichée.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export const excelSafeCell = (value) => {
  if (value === null || value === undefined) return value;

  const text = String(value);

  return FORMULA_TRIGGER.test(text) ? `'${text}` : text;
};
