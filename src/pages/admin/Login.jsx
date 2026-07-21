import { useEffect, useRef, useState } from "react";

import { Link, useLocation, useNavigate } from "react-router-dom";

import { AnimatePresence, motion } from "framer-motion";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ScrollText,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { signIn, verifyTwoFactor } from "../../services/auth";

import CodeInput from "../../components/admin/CodeInput";

import usePageMeta from "../../hooks/usePageMeta";

import logo from "../../assets/logo/logo_cava.gif";

import "./Login.scss";

// Durée de vie du jeton intermédiaire, côté serveur (5 minutes).
// Affichée pour que l'utilisateur sache qu'il n'a pas tout son temps.
const CHALLENGE_SECONDS = 5 * 60;

const Login = () => {
  usePageMeta({
    title: "Connexion à l'administration",
    description:
      "Espace d'administration du Centre Apostolique Vie et Abondance.",
  });

  const navigate = useNavigate();
  const location = useLocation();

  // "credentials" → "code". Le second écran n'apparaît que si le
  // serveur réclame un second facteur.
  const [step, setStep] = useState("credentials");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const [code, setCode] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(CHALLENGE_SECONDS);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Le jeton intermédiaire ne prouve rien à lui seul et ne doit pas
  // survivre à la page : il reste dans une ref, jamais dans le
  // stockage local.
  const challengeRef = useRef(null);

  const destination = location.state?.from ?? "/admin";

  // Compte à rebours de l'étape 2.
  useEffect(() => {
    if (step !== "code") return undefined;

    const timer = setInterval(() => {
      setSecondsLeft((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [step]);

  const backToCredentials = (message = "") => {
    challengeRef.current = null;

    setStep("credentials");
    setCode("");
    setRecoveryMode(false);
    setSecondsLeft(CHALLENGE_SECONDS);
    setError(message);
    setNotice("");
  };

  const handleCredentials = async (event) => {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const result = await signIn({ email, password });

      if (result.twoFactorRequired) {
        challengeRef.current = result.challengeToken;

        setStep("code");
        setSecondsLeft(CHALLENGE_SECONDS);

        return;
      }

      navigate(destination, { replace: true });
    } catch (caught) {
      setError(
        caught?.message ?? "La connexion n'a pas pu aboutir."
      );
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (submitted) => {
    const value = String(submitted ?? code).trim();

    if (busy || !value) return;

    setBusy(true);
    setError("");

    try {
      const result = await verifyTwoFactor({
        challengeToken: challengeRef.current,
        code: value,
      });

      // Un code de secours consommé mérite d'être signalé : il ne
      // resservira pas, et il faut en régénérer quand ils s'épuisent.
      if (result.recoveryCodeUsed) {
        setNotice(
          `Code de secours utilisé. Il vous en reste ${result.recoveryCodesLeft}.`
        );
      }

      navigate(destination, { replace: true });
    } catch (caught) {
      setError(
        caught?.message ?? "La vérification n'a pas abouti."
      );

      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="admin-login">
      {/* Halos décoratifs. `aria-hidden` : rien à annoncer. */}
      <div
        className="admin-login__glow admin-login__glow--one"
        aria-hidden="true"
      />
      <div
        className="admin-login__glow admin-login__glow--two"
        aria-hidden="true"
      />

      <div className="admin-login__shell">
        {/* ---------------- Panneau de marque ---------------- */}
        <aside className="admin-login__aside">
          <div className="admin-login__brand">
            <img
              src={logo}
              alt=""
              aria-hidden="true"
            />

            <div>
              <strong>CAVA</strong>

              <span>Centre Apostolique Vie et Abondance</span>
            </div>
          </div>

          <h2 className="admin-login__tagline">
            L&apos;espace qui fait vivre le site de l&apos;église.
          </h2>

          <p className="admin-login__lead">
            Publiez vos cultes, vos événements et vos messages. Tout ce
            que vous modifiez ici apparaît sur le site public.
          </p>

          <ul className="admin-login__assurances">
            <li>
              <ShieldCheck aria-hidden="true" />

              <div>
                <strong>Accès protégé</strong>
                <span>
                  Mot de passe chiffré et second facteur disponible
                </span>
              </div>
            </li>

            <li>
              <ScrollText aria-hidden="true" />

              <div>
                <strong>Actions tracées</strong>
                <span>
                  Chaque modification est enregistrée, avec son auteur
                </span>
              </div>
            </li>
          </ul>

          <p className="admin-login__verse">
            « Que tout se fasse avec bienséance et avec ordre. »
            <em>1 Corinthiens 14:40</em>
          </p>
        </aside>

        {/* ---------------- Panneau de connexion ---------------- */}
        <main className="admin-login__panel">
          <AnimatePresence mode="wait">
            {step === "credentials" ? (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
              >
                <span className="admin-login__eyebrow">
                  Espace réservé
                </span>

                <h1>Connexion</h1>

                <p className="admin-login__intro">
                  Identifiez-vous pour accéder à l&apos;administration
                  du site.
                </p>

                <form
                  className="admin-login__form"
                  onSubmit={handleCredentials}
                >
                  <div className="admin-login__field">
                    <label htmlFor="admin-login-email">
                      Adresse e-mail
                    </label>

                    <div className="admin-login__control">
                      <Mail aria-hidden="true" />

                      <input
                        id="admin-login-email"
                        type="email"
                        value={email}
                        onChange={(event) =>
                          setEmail(event.target.value)
                        }
                        autoComplete="username"
                        placeholder="vous@exemple.ci"
                        required
                        disabled={busy}
                      />
                    </div>
                  </div>

                  <div className="admin-login__field">
                    <label htmlFor="admin-login-password">
                      Mot de passe
                    </label>

                    <div className="admin-login__control">
                      <Lock aria-hidden="true" />

                      <input
                        id="admin-login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        onKeyUp={(event) =>
                          setCapsLock(
                            event.getModifierState?.("CapsLock") ??
                              false
                          )
                        }
                        autoComplete="current-password"
                        placeholder="••••••••••••"
                        required
                        disabled={busy}
                      />

                      <button
                        type="button"
                        className="admin-login__reveal"
                        onClick={() =>
                          setShowPassword((previous) => !previous)
                        }
                        aria-label={
                          showPassword
                            ? "Masquer le mot de passe"
                            : "Afficher le mot de passe"
                        }
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    {/* Verrouillage majuscules : cause la plus banale
                        d'un « mot de passe incorrect » inexplicable. */}
                    {capsLock && (
                      <p
                        className="admin-login__hint"
                        role="status"
                      >
                        <AlertCircle aria-hidden="true" />
                        Verrouillage majuscules activé
                      </p>
                    )}
                  </div>

                  {error && (
                    <p
                      className="admin-login__error"
                      role="alert"
                    >
                      <AlertCircle aria-hidden="true" />
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="admin-login__submit"
                    disabled={busy}
                    aria-busy={busy}
                  >
                    {busy ? (
                      <Loader2
                        className="admin-login__spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ArrowRight aria-hidden="true" />
                    )}

                    {busy ? "Vérification…" : "Se connecter"}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.22 }}
              >
                <button
                  type="button"
                  className="admin-login__back-step"
                  onClick={() => backToCredentials()}
                  disabled={busy}
                >
                  <ArrowLeft aria-hidden="true" />
                  Retour
                </button>

                <span className="admin-login__eyebrow">
                  Étape 2 sur 2
                </span>

                <h1>Vérification</h1>

                <p className="admin-login__intro">
                  {recoveryMode
                    ? "Saisissez l'un des codes de secours que vous avez conservés."
                    : "Ouvrez votre application d'authentification et saisissez le code à 6 chiffres."}
                </p>

                <div className="admin-login__device">
                  {recoveryMode ? (
                    <KeyRound aria-hidden="true" />
                  ) : (
                    <Smartphone aria-hidden="true" />
                  )}

                  <span>{email}</span>
                </div>

                <form
                  className="admin-login__form"
                  onSubmit={(event) => {
                    event.preventDefault();

                    submitCode();
                  }}
                >
                  {recoveryMode ? (
                    <div className="admin-login__field">
                      <label htmlFor="admin-login-recovery">
                        Code de secours
                      </label>

                      <div className="admin-login__control">
                        <KeyRound aria-hidden="true" />

                        <input
                          id="admin-login-recovery"
                          type="text"
                          value={code}
                          onChange={(event) =>
                            setCode(event.target.value)
                          }
                          placeholder="XXXXX-XXXXX"
                          autoComplete="one-time-code"
                          spellCheck="false"
                          autoCapitalize="characters"
                          disabled={busy}
                          autoFocus
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="admin-login__field">
                      <span className="admin-login__label">
                        Code de vérification
                      </span>

                      <CodeInput
                        value={code}
                        onChange={setCode}
                        onComplete={submitCode}
                        disabled={busy}
                        invalid={Boolean(error)}
                        autoFocus
                      />
                    </div>
                  )}

                  {error && (
                    <p
                      className="admin-login__error"
                      role="alert"
                    >
                      <AlertCircle aria-hidden="true" />
                      {error}
                    </p>
                  )}

                  {notice && (
                    <p
                      className="admin-login__notice"
                      role="status"
                    >
                      {notice}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="admin-login__submit"
                    disabled={busy || !code.trim()}
                    aria-busy={busy}
                  >
                    {busy ? (
                      <Loader2
                        className="admin-login__spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ShieldCheck aria-hidden="true" />
                    )}

                    {busy ? "Vérification…" : "Valider le code"}
                  </button>

                  <div className="admin-login__meta">
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryMode((previous) => !previous);
                        setCode("");
                        setError("");
                      }}
                      disabled={busy}
                    >
                      {recoveryMode
                        ? "Utiliser l'application"
                        : "Utiliser un code de secours"}
                    </button>

                    {secondsLeft > 0 ? (
                      <span>
                        Expire dans {minutes}:{seconds}
                      </span>
                    ) : (
                      <span className="admin-login__expired">
                        Session expirée
                      </span>
                    )}
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <Link
            to="/"
            className="admin-login__back"
          >
            Retour au site public
          </Link>
        </main>
      </div>
    </div>
  );
};

export default Login;
