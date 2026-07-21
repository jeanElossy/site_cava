import { useState } from "react";

import { FaDownload, FaShareAlt, FaSpinner } from "react-icons/fa";

import { fetchReceipt } from "../../../services/donations";

import "./ReceiptActions.scss";

// Téléchargement et partage du reçu.
//
// Le partage passe par l'API Web Share quand elle est disponible, ce
// qui est le cas sur pratiquement tous les mobiles. C'est ce qui permet
// d'envoyer le reçu sur WhatsApp en deux gestes — le canal réel des
// donateurs ici, bien avant l'e-mail.
//
// Sur ordinateur, l'API est le plus souvent absente : le bouton de
// partage n'est alors pas affiché du tout, plutôt que présent et
// inopérant.
const canShareFiles = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.share === "function" &&
  typeof navigator.canShare === "function";

const ReceiptActions = ({ reference, amount }) => {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const withReceipt = async (action, task) => {
    setBusy(action);
    setError("");

    try {
      const { blob, filename } = await fetchReceipt(reference);

      await task(blob, filename);
    } catch (caught) {
      // Un partage annulé par l'utilisateur remonte comme une erreur :
      // ce n'en est pas une, et afficher un message serait déroutant.
      if (caught?.name !== "AbortError") {
        setError(caught?.message ?? "Le reçu n'a pas pu être récupéré.");
      }
    } finally {
      setBusy("");
    }
  };

  const download = () =>
    withReceipt("download", (blob, filename) => {
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      // Libère la mémoire retenue par l'objet. Sans cela, le fichier
      // reste en mémoire tant que l'onglet est ouvert.
      URL.revokeObjectURL(url);
    });

  const share = () =>
    withReceipt("share", async (blob, filename) => {
      const file = new File([blob], filename, {
        type: "application/pdf",
      });

      // Tous les navigateurs qui exposent `share` n'acceptent pas les
      // fichiers. On vérifie avant, sinon l'appel échoue au moment le
      // plus visible pour l'utilisateur.
      if (!navigator.canShare({ files: [file] })) {
        throw new Error(
          "Le partage de fichiers n'est pas disponible sur cet appareil."
        );
      }

      await navigator.share({
        files: [file],
        title: "Reçu de contribution",
        text: `Reçu de ma contribution de ${Number(amount).toLocaleString(
          "fr-FR"
        )} F CFA au Centre Apostolique Vie et Abondance.`,
      });
    });

  return (
    <div className="receipt-actions">

      <div className="receipt-actions__buttons">
        <button
          type="button"
          className="receipt-actions__button"
          onClick={download}
          disabled={busy !== ""}
        >
          {busy === "download" ? (
            <FaSpinner className="receipt-actions__spin" aria-hidden="true" />
          ) : (
            <FaDownload aria-hidden="true" />
          )}

          {busy === "download" ? "Préparation…" : "Télécharger le reçu"}
        </button>

        {canShareFiles() && (
          <button
            type="button"
            className="receipt-actions__button receipt-actions__button--ghost"
            onClick={share}
            disabled={busy !== ""}
          >
            {busy === "share" ? (
              <FaSpinner className="receipt-actions__spin" aria-hidden="true" />
            ) : (
              <FaShareAlt aria-hidden="true" />
            )}

            Partager
          </button>
        )}
      </div>

      {error && (
        <p className="receipt-actions__error" role="alert">
          {error}
        </p>
      )}

      <p className="receipt-actions__hint">
        Le reçu porte un QR code permettant d'en vérifier l'authenticité
        à tout moment.
      </p>

    </div>
  );
};

export default ReceiptActions;
