import "./ContributionSuccessModal.scss";

import {
  FaCheckCircle,
  FaDownload,
  FaHome,
  FaHeart,
} from "react-icons/fa";

const ContributionSuccessModal = ({
  isOpen,
  onClose,
  transaction,
}) => {
  if (!isOpen) return null;

  return (
    <div className="success-modal">

      <div className="success-modal__backdrop" />

      <div className="success-modal__content">

        <div className="success-icon">
          <FaCheckCircle />
        </div>

        <h2>
          Paiement confirmé
        </h2>

        <p>
          Merci pour votre contribution.
        </p>

        <div className="transaction-card">

          <div>
            <span>Référence</span>
            <strong>
              {transaction.id}
            </strong>
          </div>

          <div>
            <span>Type</span>
            <strong>
              {transaction.type}
            </strong>
          </div>

          <div>
            <span>Montant</span>
            <strong>
              {transaction.amount}
              {" "}
              FCFA
            </strong>
          </div>

        </div>

        <div className="success-actions">

          <button className="download-btn">
            <FaDownload />
            Télécharger le reçu
          </button>

          <button className="secondary-btn">
            <FaHome />
            Accueil
          </button>

          <button
            className="secondary-btn"
            onClick={onClose}
          >
            <FaHeart />
            Nouvelle contribution
          </button>

        </div>

      </div>

    </div>
  );
};

export default ContributionSuccessModal;