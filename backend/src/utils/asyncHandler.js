// Enveloppe les handlers asynchrones et redirige tout rejet vers le
// middleware d'erreur global.
//
// C'est le try/catch exigé par les conventions du projet, factorisé une
// seule fois : oublier `.catch(next)` sur un handler async laisse la
// requête pendre jusqu'au timeout, et le bug est silencieux. Un seul
// endroit à relire vaut mieux que soixante blocs try/catch identiques.
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
