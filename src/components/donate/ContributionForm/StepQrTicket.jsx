import { Leaf } from "lucide-react";

// Étape 3 : le QR à scanner, mis en forme comme un billet d'offrande
// numérique — enveloppe d'offrande physique réinventée (voir la
// section Design visuel de la spec). Composant purement
// présentationnel : la navigation reste gérée par l'orchestrateur.
const StepQrTicket = ({ state }) => {
  const amount = Number(state.amount || 0).toLocaleString("fr-FR");
  const donorName = [state.donor.firstName, state.donor.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="step-panel">

      <div className="offering-ticket">

        <div className="offering-ticket__notch offering-ticket__notch--left" aria-hidden="true" />
        <div className="offering-ticket__notch offering-ticket__notch--right" aria-hidden="true" />

        <p className="offering-ticket__eyebrow">
          <Leaf size={14} aria-hidden="true" />
          Scannez pour donner
        </p>

        <div className="offering-ticket__qr">
          {state.paymentMethod.image ? (
            <img src={state.paymentMethod.image} alt={`QR code ${state.paymentMethod.name}`} />
          ) : (
            <p className="offering-ticket__qr-missing">
              QR indisponible pour ce moyen de paiement.
            </p>
          )}
        </div>

        <p className="offering-ticket__amount">{amount} F CFA</p>

        <dl className="offering-ticket__details">
          <div>
            <dt>Donateur</dt>
            <dd>{donorName || "—"}</dd>
          </div>
          <div>
            <dt>Type de don</dt>
            <dd>{state.donationType.name || "—"}</dd>
          </div>
          <div>
            <dt>Moyen</dt>
            <dd>{state.paymentMethod.name || "—"}</dd>
          </div>
        </dl>

        {/* Numéro et titulaire en clair, pas seulement le QR.
            Beaucoup de donateurs scannent le QR projeté pendant le
            culte avec leur téléphone et atterrissent sur cette page
            AVEC CE MÊME téléphone : ils ne peuvent pas en scanner un
            second à l'écran. Le numéro composé à la main est leur
            seule issue. */}
        {state.paymentMethod.accountNumber && (
          <div className="offering-ticket__manual">
            <p className="offering-ticket__manual-label">
              Ou payez au numéro
            </p>

            <p className="offering-ticket__manual-number">
              {state.paymentMethod.accountNumber}
            </p>

            {state.paymentMethod.holderName && (
              <p className="offering-ticket__manual-holder">
                {state.paymentMethod.holderName}
              </p>
            )}
          </div>
        )}

      </div>

      <p className="step-panel__hint">
        Ouvrez votre application {state.paymentMethod.name || "Mobile Money"}, scannez ce code
        et réglez le montant ci-dessus. Si vous lisez cette page depuis le téléphone qui a
        scanné le QR code, composez plutôt le numéro indiqué sur le billet. Une fois le
        paiement effectué, passez à l&apos;étape suivante.
      </p>

    </div>
  );
};

export default StepQrTicket;
