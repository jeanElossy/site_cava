// Format de réponse unique pour toute l'API (voir api-guidelines.md).
//
//   succès : { success: true,  message, data, meta? }
//   erreur : { success: false, message, error }
//
// Le front n'a jamais à deviner la forme d'une réponse : `success` seul
// suffit à savoir s'il faut lire `data` ou `error`.

export const sendSuccess = (res, { status = 200, message = null, data = null, meta } = {}) => {
  const payload = { success: true, message, data };

  if (meta) payload.meta = meta;

  return res.status(status).json(payload);
};

export const sendCreated = (res, { message, data }) =>
  sendSuccess(res, { status: 201, message, data });

// 204 : suppression réussie, rien à renvoyer. Pas de corps, conformément
// à la sémantique HTTP.
export const sendNoContent = (res) => res.status(204).end();
