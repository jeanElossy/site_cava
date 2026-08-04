import { useEffect, useState } from "react";

import { useSearchParams } from "react-router-dom";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  QrCode,
  ShieldCheck,
  User,
} from "lucide-react";

import { presenceAgentLogin, verifyPresenceQr } from "../../services/presences";
import { extractQrParam } from "../../utils/qrLink";

import QrCameraScanner from "../../components/presence/QrCameraScanner/QrCameraScanner";

import logo from "../../assets/logo/logo_cava.gif";

const PresenceLogin = ({ onAuthenticated }) => {
  const [searchParams] = useSearchParams();

  const [matricule, setMatricule] = useState("");
  const [qrToken, setQrToken] = useState(null);
  const [qrInfo, setQrInfo] = useState(null);
  // Caméra désactivée d'entrée si un jeton est déjà fourni par l'URL
  // (lien scanné hors de la page) — évite d'ouvrir la caméra pour rien
  // le temps que la vérification aboutisse.
  const [scanning, setScanning] = useState(() => !searchParams.get("qr"));
  // Vrai dès le premier rendu si l'URL fournit déjà un jeton : la
  // vérification démarre dans l'effet ci-dessous, avant même le
  // premier affichage utile.
  const [verifying, setVerifying] = useState(() => Boolean(searchParams.get("qr")));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Aucun `setState` synchrone dans le corps : chaque mise à jour a
  // lieu dans un callback de la promesse (.then/.catch/.finally),
  // jamais avant son premier `await` implicite — c'est ce qui permet
  // d'appeler `verify` directement depuis l'effet de montage ci-dessous
  // sans déclencher de rendu en cascade synchrone.
  const verify = (token) =>
    verifyPresenceQr(token)
      .then((info) => {
        setQrToken(token);
        setQrInfo(info);
        setScanning(false);
        setError("");
      })
      .catch((caught) => {
        setError(caught?.message ?? "Ce QR de sécurité est invalide.");
        setQrToken(null);
        setQrInfo(null);
      })
      .finally(() => setVerifying(false));

  // Un lien scanné directement par l'appareil photo natif du téléphone
  // (hors de cette page) atterrit ici avec `?qr=` déjà dans l'URL : la
  // caméra intégrée à la page n'a alors rien à faire.
  useEffect(() => {
    const fromUrl = searchParams.get("qr");

    if (fromUrl) verify(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDecode = (decoded) => {
    if (verifying) return;

    setScanning(false);
    setVerifying(true);
    verify(extractQrParam(decoded, "qr"));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (busy || !matricule.trim() || !qrToken || !qrInfo) return;

    setBusy(true);
    setError("");

    try {
      const result = await presenceAgentLogin({
        token: qrToken,
        matricule: matricule.trim(),
      });

      onAuthenticated(result);
    } catch (caught) {
      setError(caught?.message ?? "La connexion n'a pas abouti.");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = Boolean(matricule.trim() && qrToken && qrInfo && !busy);

  return (
    <div className="presence-login">
      <div className="presence-login__shell">
        <header className="presence-login__brand">
          <img
            src={logo}
            alt=""
            aria-hidden="true"
          />

          <div>
            <strong>CAVA</strong>
            <span>Centre Apostolique Vie et Abondance</span>
          </div>
        </header>

        <div className="presence-login__intro">
          <ShieldCheck aria-hidden="true" />
          <h1>
            Connexion <span>agent</span>
          </h1>
          <p>
            Pour accéder au système de badgeage, entrez votre matricule
            et scannez le QR de sécurité.
          </p>
        </div>

        <form
          className="presence-login__form"
          onSubmit={handleSubmit}
        >
          <section className="presence-login__step">
            <h2>
              <span className="presence-login__step-index">1</span>
              Entrez votre matricule
            </h2>

            <label htmlFor="presence-matricule">Matricule de l&apos;agent</label>

            <div className="presence-login__control">
              <User aria-hidden="true" />

              <input
                id="presence-matricule"
                type="text"
                value={matricule}
                onChange={(event) => setMatricule(event.target.value)}
                placeholder="Ex : 1OL 25-045 S"
                autoComplete="off"
                disabled={busy}
              />
            </div>

            <p className="presence-login__step-hint">
              Le matricule vous est attribué par l&apos;administration.
            </p>
          </section>

          <section className="presence-login__step">
            <h2>
              <span className="presence-login__step-index">2</span>
              Scannez le QR de sécurité
            </h2>

            <p className="presence-login__step-lead">
              Scannez le QR code fourni par l&apos;administrateur
            </p>

            {qrInfo ? (
              <div
                className="presence-login__qr-verified"
                role="status"
              >
                <CheckCircle2 aria-hidden="true" />

                <div>
                  <strong>{qrInfo.label}</strong>
                  <span>
                    Valide jusqu&apos;à{" "}
                    {new Date(qrInfo.validUntil).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ) : (
              <QrCameraScanner
                active={scanning && !verifying}
                onDecode={handleDecode}
                onError={setError}
                hint={
                  verifying
                    ? "Vérification du QR…"
                    : "Placez le QR de sécurité dans le cadre."
                }
              />
            )}

            {!qrInfo && !scanning && !verifying && (
              <button
                type="button"
                className="presence-login__retry"
                onClick={() => {
                  setError("");
                  setScanning(true);
                }}
              >
                <QrCode aria-hidden="true" />
                Réessayer le scan
              </button>
            )}

            <p className="presence-login__step-hint">
              Le QR code est valable uniquement pour l&apos;événement en
              cours.
            </p>
          </section>

          {error && (
            <p
              className="presence-login__error"
              role="alert"
            >
              <AlertCircle aria-hidden="true" />
              {error}
            </p>
          )}

          <button
            type="submit"
            className="presence-login__submit"
            disabled={!canSubmit}
            aria-busy={busy}
          >
            {busy ? (
              <Loader2
                className="presence-login__spin"
                aria-hidden="true"
              />
            ) : (
              <ArrowRight aria-hidden="true" />
            )}
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="presence-login__notice">
          <Info aria-hidden="true" />
          Chaque QR code est valable pour une période limitée. Vous
          devrez le scanner à chaque nouvel événement.
        </p>
      </div>
    </div>
  );
};

export default PresenceLogin;
