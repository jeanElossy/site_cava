// Extrait un paramètre de requête d'un contenu de QR décodé — soit une
// URL complète (le cas normal, tous les QR de ce projet encodent un
// lien), soit, en repli, le contenu brut lui-même si ce n'est pas une
// URL analysable.
export const extractQrParam = (decoded, param) => {
  try {
    const url = new URL(decoded);
    return url.searchParams.get(param) ?? decoded;
  } catch {
    return decoded;
  }
};
