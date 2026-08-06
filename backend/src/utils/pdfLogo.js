// Centre une image sur la largeur imprimable de la page — nécessaire
// car l'option `align` de pdfkit ne centre RIEN sans `fit`/`cover`
// (voir node_modules/pdfkit/js/pdfkit.js, la branche `align === "center"`
// est imbriquée sous `if (options.fit || options.cover)`) : le logo
// restait donc collé à la marge gauche malgré `{ align: "center" }`
// dans presence.service.js et presenceExport.service.js.
export const drawCenteredImage = (doc, imagePath, width) => {
  const printableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x = doc.page.margins.left + Math.max(0, (printableWidth - width) / 2);

  // `y` explicitement `undefined` (pas omis) : pdfkit ne bascule en
  // "flux du document" (avance automatique de `doc.y` de la hauteur
  // réelle de l'image, quel que soit son ratio) que si le paramètre
  // `y` n'est pas un nombre — passer `x` seul sans cela figerait `doc.y`.
  doc.image(imagePath, x, undefined, { width });
};
