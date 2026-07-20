import { Link } from "react-router-dom";

import "./ContributionSuccessModal.scss";

import {
  FaCheckCircle,
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

          {/*
            Le bouton « Télécharger le reçu » a été retiré : le site est
            entièrement statique, il n'existe ni backend ni génération de
            reçu. À réintroduire le jour où un service de paiement réel
            sera branché.
          */}

          <Link
            to="/"
            className="secondary-btn"
            onClick={onClose}
          >
            <FaHome aria-hidden="true" />
            Accueil
          </Link>

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