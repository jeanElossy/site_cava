import { useCallback, useState } from "react";

import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";

import {
  disableTwoFactor,
  enableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
  twoFactorStatus,
} from "../../../services/auth";

import useAsyncData from "../../../hooks/useAsyncData";

import CodeInput from "../CodeInput";

import "./TwoFactorPanel.scss";

// Gestion de la double authentification depuis l'espace connecté.
//
// Trois écrans successifs à l'activation : scanner le QR, prouver que
// l'application génère bien le bon code, puis conserver les codes de
// secours. L'étape de preuve n'est pas décorative — sans elle, un
// utilisateur qui scanne mal se verrouillerait hors de son compte.
const TwoFactorPanel = () => {
  const load = useCallback(() => twoFactorStatus(), []);

  const {
    data: status,
    loading,
    error: loadError,
    reload,
  } = useAsyncData(load);

  // null | "setup" | "codes" | "disable" | "regenerate"
  const [mode, setMode] = useState(null);

  const [setupData, setSetupData] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setMode(null);
    setSetupData(null);
    setRecoveryCodes(null);
    setCode("");
    setPassword("");
    setError("");
    setCopied(false);
  };

  const run = async (action) => {
    setBusy(true);
    setError("");

    try {
      await action();
    } catch (caught) {
      setError(caught?.message ?? "L'opération a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const beginSetup = () =>
    run(async () => {
      const data = await startTwoFactorSetup();

      setSetupData(data);
      setCode("");
      setMode("setup");
    });

  const confirmSetup = (submitted) =>
    run(async () => {
      const data = await enableTwoFactor(submitted ?? code);

      setRecoveryCodes(data.recoveryCodes);
      setMode("codes");
      setCode("");

      // `reload` ne renvoie pas de promesse : il déclenche un nouveau
      // rendu, la donnée arrive ensuite.
      reload();
    });

  const confirmDisable = () =>
    run(async () => {
      await disableTwoFactor({ password, code });

      reset();

      // `reload` ne renvoie pas de promesse : il déclenche un nouveau
      // rendu, la donnée arrive ensuite.
      reload();
    });

  const confirmRegenerate = () =>
    run(async () => {
      const data = await regenerateRecoveryCodes(password);

      setRecoveryCodes(data.recoveryCodes);
      setMode("codes");
      setPassword("");

      // `reload` ne renvoie pas de promesse : il déclenche un nouveau
      // rendu, la donnée arrive ensuite.
      reload();
    });

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(
        recoveryCodes.join("\n")
      );

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        "Copie impossible depuis ce navigateur. Notez les codes manuellement."
      );
    }
  };

  // Téléchargement d'un fichier texte, sans passer par un serveur :
  // un Blob local suffit, et la CSP n'a pas à être élargie.
  const downloadCodes = () => {
    const content = [
      "Codes de secours — Administration CAVA",
      `Générés le ${new Date().toLocaleString("fr-FR")}`,
      "",
      "Chaque code ne fonctionne qu'une seule fois.",
      "Conservez ce fichier hors de votre téléphone.",
      "",
      ...recoveryCodes,
    ].join("\n");

    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain;charset=utf-8" })
    );

    const link = document.createElement("a");

    link.href = url;
    link.download = "codes-secours-cava.txt";
    link.click();

    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <section className="admin-2fa">
        <p className="admin-2fa__loading">
          <Loader2
            className="admin-2fa__spin"
            aria-hidden="true"
          />
          Chargement…
        </p>
      </section>
    );
  }

  // Échec du chargement de l'état : surtout NE PAS retomber sur
  // l'affichage « désactivée ». Cela laisserait croire que le compte
  // est sans protection, et proposerait une activation qui écraserait
  // peut-être une configuration existante.
  if (loadError) {
    return (
      <section className="admin-2fa">
        <p
          className="admin-2fa__error"
          role="alert"
        >
          <AlertTriangle aria-hidden="true" />
          Impossible de lire l&apos;état de la double
          authentification : {loadError}
        </p>

        <div className="admin-2fa__actions">
          <button
            type="button"
            className="admin-2fa__button"
            onClick={reload}
          >
            Réessayer
          </button>
        </div>
      </section>
    );
  }

  const enabled = Boolean(status?.enabled);

  return (
    <section className="admin-2fa">
      <header className="admin-2fa__header">
        <div className="admin-2fa__title">
          {enabled ? (
            <ShieldCheck aria-hidden="true" />
          ) : (
            <ShieldOff aria-hidden="true" />
          )}

          <div>
            <h2>Double authentification</h2>

            <p>
              Un code temporaire est demandé à chaque connexion, en
              plus du mot de passe.
            </p>
          </div>
        </div>

        <span
          className={`admin-2fa__badge${
            enabled ? " admin-2fa__badge--on" : ""
          }`}
        >
          {enabled ? "Activée" : "Désactivée"}
        </span>
      </header>

      {error && (
        <p
          className="admin-2fa__error"
          role="alert"
        >
          <AlertTriangle aria-hidden="true" />
          {error}
        </p>
      )}

      {/* ---------------- Repos ---------------- */}
      {mode === null && (
        <div className="admin-2fa__body">
          {enabled ? (
            <>
              <dl className="admin-2fa__facts">
                <div>
                  <dt>Activée le</dt>
                  <dd>
                    {status.activatedAt
                      ? new Date(
                          status.activatedAt
                        ).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </dd>
                </div>

                <div>
                  <dt>Codes de secours restants</dt>
                  <dd
                    className={
                      status.recoveryCodesLeft <= 2
                        ? "admin-2fa__low"
                        : undefined
                    }
                  >
                    {status.recoveryCodesLeft} sur 10
                  </dd>
                </div>
              </dl>

              {status.recoveryCodesLeft <= 2 && (
                <p
                  className="admin-2fa__warn"
                  role="status"
                >
                  <AlertTriangle aria-hidden="true" />
                  Il vous reste peu de codes de secours. Régénérez-les
                  pour ne pas risquer de perdre l&apos;accès.
                </p>
              )}

              <div className="admin-2fa__actions">
                <button
                  type="button"
                  className="admin-2fa__button"
                  onClick={() => {
                    setMode("regenerate");
                    setError("");
                  }}
                >
                  <KeyRound aria-hidden="true" />
                  Régénérer les codes de secours
                </button>

                <button
                  type="button"
                  className="admin-2fa__button admin-2fa__button--danger"
                  onClick={() => {
                    setMode("disable");
                    setError("");
                  }}
                >
                  <ShieldOff aria-hidden="true" />
                  Désactiver
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="admin-2fa__pitch">
                Sans second facteur, votre mot de passe est la seule
                barrière : s&apos;il fuite — hameçonnage, réemploi sur
                un autre site — n&apos;importe qui peut publier à votre
                place. Avec, il faut aussi votre téléphone.
              </p>

              <button
                type="button"
                className="admin-2fa__button admin-2fa__button--primary"
                onClick={beginSetup}
                disabled={busy}
              >
                {busy ? (
                  <Loader2
                    className="admin-2fa__spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldCheck aria-hidden="true" />
                )}
                Activer la double authentification
              </button>
            </>
          )}
        </div>
      )}

      {/* ---------------- Installation ---------------- */}
      {mode === "setup" && setupData && (
        <div className="admin-2fa__body">
          <ol className="admin-2fa__steps">
            <li>
              Installez une application d&apos;authentification :
              Google Authenticator, Microsoft Authenticator ou Authy.
            </li>
            <li>Scannez ce QR code avec l&apos;application.</li>
            <li>Saisissez le code à 6 chiffres qu&apos;elle affiche.</li>
          </ol>

          <div className="admin-2fa__setup">
            <img
              className="admin-2fa__qr"
              src={setupData.qrDataUrl}
              alt="QR code à scanner avec votre application d'authentification"
            />

            <div className="admin-2fa__manual">
              <span>Impossible de scanner ?</span>

              <p>Saisissez cette clé à la main :</p>

              <code>{setupData.secret}</code>
            </div>
          </div>

          <div className="admin-2fa__verify">
            <span className="admin-2fa__label">
              Code affiché par l&apos;application
            </span>

            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={confirmSetup}
              disabled={busy}
              invalid={Boolean(error)}
              autoFocus
            />
          </div>

          <div className="admin-2fa__actions">
            <button
              type="button"
              className="admin-2fa__button admin-2fa__button--primary"
              onClick={() => confirmSetup()}
              disabled={busy || code.length !== 6}
            >
              {busy ? (
                <Loader2
                  className="admin-2fa__spin"
                  aria-hidden="true"
                />
              ) : (
                <Check aria-hidden="true" />
              )}
              Vérifier et activer
            </button>

            <button
              type="button"
              className="admin-2fa__button"
              onClick={reset}
              disabled={busy}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Codes de secours ---------------- */}
      {mode === "codes" && recoveryCodes && (
        <div className="admin-2fa__body">
          <p className="admin-2fa__warn">
            <AlertTriangle aria-hidden="true" />
            Ces codes ne seront affichés qu&apos;une seule fois. Ils
            sont stockés hachés : personne, pas même nous, ne peut les
            retrouver ensuite.
          </p>

          <ul className="admin-2fa__codes">
            {recoveryCodes.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>

          <div className="admin-2fa__actions">
            <button
              type="button"
              className="admin-2fa__button"
              onClick={copyCodes}
            >
              {copied ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
              {copied ? "Copié" : "Copier"}
            </button>

            <button
              type="button"
              className="admin-2fa__button"
              onClick={downloadCodes}
            >
              <Download aria-hidden="true" />
              Télécharger
            </button>

            <button
              type="button"
              className="admin-2fa__button admin-2fa__button--primary"
              onClick={reset}
            >
              <Check aria-hidden="true" />
              Je les ai conservés
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Désactivation ---------------- */}
      {mode === "disable" && (
        <div className="admin-2fa__body">
          <p className="admin-2fa__warn">
            <AlertTriangle aria-hidden="true" />
            Votre compte ne sera plus protégé que par son mot de passe.
          </p>

          <div className="admin-2fa__field">
            <label htmlFor="admin-2fa-password">
              Mot de passe actuel
            </label>

            <input
              id="admin-2fa-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
          </div>

          <div className="admin-2fa__field">
            <label htmlFor="admin-2fa-code">
              Code de l&apos;application ou code de secours
            </label>

            <input
              id="admin-2fa-code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              inputMode="text"
              disabled={busy}
            />
          </div>

          <div className="admin-2fa__actions">
            <button
              type="button"
              className="admin-2fa__button admin-2fa__button--danger"
              onClick={confirmDisable}
              disabled={busy || !password || !code}
            >
              {busy ? (
                <Loader2
                  className="admin-2fa__spin"
                  aria-hidden="true"
                />
              ) : (
                <ShieldOff aria-hidden="true" />
              )}
              Confirmer la désactivation
            </button>

            <button
              type="button"
              className="admin-2fa__button"
              onClick={reset}
              disabled={busy}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Régénération ---------------- */}
      {mode === "regenerate" && (
        <div className="admin-2fa__body">
          <p className="admin-2fa__pitch">
            Les codes actuels seront invalidés et remplacés par dix
            nouveaux.
          </p>

          <div className="admin-2fa__field">
            <label htmlFor="admin-2fa-password-regen">
              Mot de passe actuel
            </label>

            <input
              id="admin-2fa-password-regen"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
          </div>

          <div className="admin-2fa__actions">
            <button
              type="button"
              className="admin-2fa__button admin-2fa__button--primary"
              onClick={confirmRegenerate}
              disabled={busy || !password}
            >
              {busy ? (
                <Loader2
                  className="admin-2fa__spin"
                  aria-hidden="true"
                />
              ) : (
                <KeyRound aria-hidden="true" />
              )}
              Générer de nouveaux codes
            </button>

            <button
              type="button"
              className="admin-2fa__button"
              onClick={reset}
              disabled={busy}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {mode === null && !enabled && (
        <p className="admin-2fa__foot">
          <Smartphone aria-hidden="true" />
          Fonctionne hors connexion, sans SMS et sans frais.
        </p>
      )}
    </section>
  );
};

export default TwoFactorPanel;
