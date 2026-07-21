// Montant en toutes lettres, pour les reçus.
//
// ------------------------------------------------------------------
// POURQUOI CE N'EST PAS UNE COQUETTERIE
// ------------------------------------------------------------------
// Sur un reçu, le montant en lettres fait foi contre le montant en
// chiffres : un « 5 000 » se retouche d'un trait de stylo, pas un
// « cinq mille ». C'est la raison pour laquelle chèques et quittances
// portent les deux depuis toujours.
//
// Le français a des règles d'accord qu'aucune approximation ne
// rattrape : « quatre-vingts » prend un s seul, « quatre-vingt-un »
// n'en prend pas ; « deux cents » en prend un, « deux cent un » non ;
// « mille » est invariable. Un reçu mal orthographié décrédibilise
// l'église auprès de son donateur — d'où ce module isolé et testé.

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept",
  "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze",
  "quinze", "seize",
];

const TENS = {
  20: "vingt",
  30: "trente",
  40: "quarante",
  50: "cinquante",
  60: "soixante",
};

const below100 = (n) => {
  if (n < 17) return UNITS[n];

  // 17, 18, 19 : construits sur « dix ».
  if (n < 20) return `dix-${UNITS[n - 10]}`;

  if (n < 70) {
    const ten = Math.floor(n / 10) * 10;
    const unit = n % 10;

    if (unit === 0) return TENS[ten];

    // « et un » sans trait d'union : vingt et un, soixante et un.
    if (unit === 1) return `${TENS[ten]} et un`;

    return `${TENS[ten]}-${UNITS[unit]}`;
  }

  // 70-79 : « soixante » suivi de dix à dix-neuf.
  if (n < 80) {
    if (n === 71) return "soixante et onze";

    return `soixante-${below100(n - 60)}`;
  }

  // 80-99 : « quatre-vingt », qui ne prend un s que seul.
  if (n === 80) return "quatre-vingts";

  return `quatre-vingt-${below100(n - 80)}`;
};

const below1000 = (n) => {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (hundreds === 0) return below100(rest);

  // « cent » prend un s quand rien ne le suit : deux cents, mais
  // deux cent un.
  if (rest === 0) {
    return hundreds === 1 ? "cent" : `${UNITS[hundreds]} cents`;
  }

  const prefix = hundreds === 1 ? "cent" : `${UNITS[hundreds]} cent`;

  return `${prefix} ${below100(rest)}`;
};

// « vingt » et « cent » ne prennent leur s que s'ils terminent le
// nombre. Devant « mille », qui est un numéral, ils le perdent :
// deux cent mille, quatre-vingt mille.
//
// Devant « millions », en revanche, ils le gardent : « millions » est
// un NOM, pas un numéral, et le multiplicateur reste au pluriel —
// deux cents millions. C'est la subtilité que la règle scolaire
// « toujours invariable devant mille » fait manquer.
const dropPluralMark = (text) =>
  text
    .replace(/cents$/, "cent")
    .replace(/quatre-vingts$/, "quatre-vingt");

export const toFrenchWords = (value) => {
  const n = Math.trunc(Math.abs(Number(value) || 0));

  if (n === 0) return "zéro";

  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const rest = n % 1000;

  const parts = [];

  if (millions > 0) {
    parts.push(
      millions === 1 ? "un million" : `${below1000(millions)} millions`
    );
  }

  // « mille » est invariable, et ne se dit jamais « un mille ».
  if (thousands > 0) {
    parts.push(
      thousands === 1
        ? "mille"
        : `${dropPluralMark(below1000(thousands))} mille`
    );
  }

  if (rest > 0) parts.push(below1000(rest));

  return parts.join(" ");
};

export default toFrenchWords;
