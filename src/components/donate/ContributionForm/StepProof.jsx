// src/components/donate/ContributionForm/StepProof.jsx
import { useState } from "react";

import { Wheat, Loader2, Image as ImageIcon, X } from "lucide-react";

import { uploadDonationProof } from "../../../services/uploads";

// Étape 4 : la preuve — l'« épi » du parcours. Le numéro de
// transaction est obligatoire (propre à chaque opération, donc
// difficile à rejouer) ; la capture d'écran reste un complément
// optionnel (voir la spec : une capture seule peut être une ancienne
// capture réutilisée).
const StepProof = ({ state, dispatch }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      const { url } = await uploadDonationProof(file);

      dispatch({ type: "SET_PROOF_IMAGE", payload: url });
    } catch (error) {
      setUploadError(error.message ?? "L'envoi de l'image a échoué.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="step-panel">

      <div className="form-group">
        <label htmlFor="transaction-id">Numéro de transaction Mobile Money</label>

        <input
          id="transaction-id"
          type="text"
          placeholder="Reçu par SMS après votre paiement"
          value={state.proof.transactionId}
          onChange={(e) =>
            dispatch({ type: "SET_TRANSACTION_ID", payload: e.target.value })
          }
        />

        <p className="step-panel__hint">
          Ce numéro nous permet de vérifier votre paiement auprès de notre relevé Mobile Money.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="proof-image">Capture ou photo du reçu (optionnel)</label>

        {!state.proof.imageUrl && (
          <label className="proof-upload">
            {uploading ? (
              <>
                <Loader2 className="proof-upload__spin" size={18} aria-hidden="true" />
                Envoi en cours…
              </>
            ) : (
              <>
                <ImageIcon size={18} aria-hidden="true" />
                Ajouter une image
              </>
            )}

            <input
              id="proof-image"
              type="file"
              accept="image/*"
              onChange={handleFile}
              disabled={uploading}
            />
          </label>
        )}

        {state.proof.imageUrl && (
          <div className="proof-preview">
            <img src={state.proof.imageUrl} alt="Aperçu de la preuve envoyée" />

            <button
              type="button"
              className="proof-preview__remove"
              onClick={() => dispatch({ type: "SET_PROOF_IMAGE", payload: "" })}
            >
              <X size={14} aria-hidden="true" />
              Retirer
            </button>
          </div>
        )}

        {uploadError && (
          <p className="step-panel__hint step-panel__hint--error">{uploadError}</p>
        )}
      </div>

      <p className="step-panel__growth-hint">
        <Wheat size={15} aria-hidden="true" />
        Dernière étape avant la récolte : envoyez votre don pour vérification.
      </p>

    </div>
  );
};

export default StepProof;
