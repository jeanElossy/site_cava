import { useCallback, useEffect, useRef, useState } from "react";

import { Link, useSearchParams } from "react-router-dom";

import {
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaSpinner,
  FaHome,
  FaRedo,
} from "react-icons/fa";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import { donationStatus } from "../../services/donations";

import usePageMeta from "../../hooks/usePageMeta";

import "./DonationReturn.scss";

// Page d'atterrissage après le guichet de paiement.
//
// ------------------------------------------------------------------
// POURQUOI ELLE INTERROGE EN BOUCLE
// ------------------------------------------------------------------
// Le donateur revient ici dès qu'il a validé, souvent AVANT que
// l'opérateur mobile n'ait fini de traiter le paiement et que le
// prestataire ne nous ait notifiés. Afficher un verdict au premier
// appel afficherait « échec » à des gens qui viennent de payer.
//
// On interroge donc plusieurs fois, en espaçant : le serveur
// reconsulte le prestataire à chaque appel, et bascule le don dès que
// l'opérateur a tranché.
//
// Cette page ne décide jamais rien elle-même : elle lit un état.

const MAX_ATTEMPTS = 10;
const DELAY_MS = 3000;

const DonationReturn = () => {
  usePageMeta({
    title: "Votre contribution",
    description:
      "Confirmation de votre contribution au Centre Apostolique Vie et Abondance.",
  });

  const [searchParams] = useSearchParams();

  const reference = searchParams.get("ref") ?? "";

  const [donation, setDonation] = useState(null);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);

  // Gardé dans une ref pour que la boucle ne se relance pas à chaque
  // rendu : sans cela, chaque mise à jour d'état créerait un nouveau
  // minuteur, et les appels s'empileraient.
  const timerRef = useRef(null);

  const check = useCallback(async () => {
    try {
      const data = await donationStatus(reference);

      setDonation(data);
      setError("");

      return data.status;
    } catch (fetchError) {
      setError(
        fetchError.status === 404
          ? "Cette référence de contribution est introuvable."
          : "Impossible de vérifier votre contribution pour le moment."
      );

      return "error";
    }
  }, [reference]);

  useEffect(() => {
    if (!reference) return undefined;

    let cancelled = false;

    const run = async (attempt) => {
      const status = await check();

      if (cancelled) return;

      setAttempts(attempt);

      // Statut définitif, ou trop d'essais : on arrête d'interroger.
      if (status !== "pending" || attempt >= MAX_ATTEMPTS) return;

      timerRef.current = setTimeout(() => run(attempt + 1), DELAY_MS);
    };

    run(1);

    return () => {
      cancelled = true;

      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reference, check]);

  const amount = donation
    ? Number(donation.amount).toLocaleString("fr-FR")
    : "";

  const stillWaiting =
    donation?.status === "pending" && attempts < MAX_ATTEMPTS;

  const renderBody = () => {
    if (!reference) {
      return {
        tone: "failed",
        icon: <FaTimesCircle aria-hidden="true" />,
        title: "Référence manquante",
        text: "Le lien utilisé ne contient pas de référence de contribution.",
      };
    }

    if (error) {
      return {
        tone: "failed",
        icon: <FaTimesCircle aria-hidden="true" />,
        title: "Vérification impossible",
        text: error,
      };
    }

    if (!donation || stillWaiting) {
      return {
        tone: "pending",
        icon: (
          <FaSpinner
            className="donation-return__spin"
            aria-hidden="true"
          />
        ),
        title: "Vérification en cours…",
        text: "Nous confirmons votre paiement auprès de l'opérateur. Merci de rester sur cette page quelques instants.",
      };
    }

    if (donation.status === "paid") {
      return {
        tone: "paid",
        icon: <FaCheckCircle aria-hidden="true" />,
        title: "Merci pour votre contribution !",
        text: `Votre don de ${amount} FCFA a bien été reçu. Que Dieu vous le rende au centuple.`,
      };
    }

    if (donation.status === "suspect") {
      return {
        tone: "suspect",
        icon: <FaExclamationTriangle aria-hidden="true" />,
        title: "Contribution à vérifier",
        text: "Votre paiement a été enregistré, mais un écart a été constaté sur le montant. Notre équipe le vérifie et vous recontactera. Aucune action de votre part n'est nécessaire.",
      };
    }

    if (donation.status === "pending") {
      return {
        tone: "pending",
        icon: <FaExclamationTriangle aria-hidden="true" />,
        title: "Confirmation en attente",
        text: "L'opérateur n'a pas encore confirmé votre paiement. Si votre compte a été débité, la contribution sera enregistrée automatiquement. Conservez la référence ci-dessous.",
      };
    }

    return {
      tone: "failed",
      icon: <FaTimesCircle aria-hidden="true" />,
      title: "Paiement non abouti",
      text: "Votre contribution n'a pas pu être encaissée. Aucun montant n'a été prélevé. Vous pouvez réessayer.",
    };
  };

  const body = renderBody();

  return (
    <>
      <Navbar />

      <main className="donation-return">
        <div className="donation-return__container">
          <div
            className={`donation-return__card donation-return__card--${body.tone}`}
            role="status"
            aria-live="polite"
          >
            <span className="donation-return__icon" aria-hidden="true">
              {body.icon}
            </span>

            <h1>{body.title}</h1>

            <p className="donation-return__text">{body.text}</p>

            {donation && (
              <dl className="donation-return__details">
                <div>
                  <dt>Référence</dt>
                  <dd>{donation.reference}</dd>
                </div>

                <div>
                  <dt>Montant</dt>
                  <dd>{amount} FCFA</dd>
                </div>
              </dl>
            )}

            <div className="donation-return__actions">
              <Link
                to="/"
                className="donation-return__button donation-return__button--ghost"
              >
                <FaHome aria-hidden="true" />
                Retour à l'accueil
              </Link>

              {(body.tone === "failed" || donation?.status === "failed") && (
                <Link
                  to="/donate"
                  className="donation-return__button"
                >
                  <FaRedo aria-hidden="true" />
                  Réessayer
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default DonationReturn;
