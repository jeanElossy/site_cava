import { useState } from "react";

import { Link, useLocation, useNavigate } from "react-router-dom";

import { FaExclamationTriangle, FaLock } from "react-icons/fa";

import { signIn } from "../../services/auth";

import usePageMeta from "../../hooks/usePageMeta";

import logo from "../../assets/logo/logo_cava.gif";

import "./Login.scss";

const Login = () => {
  usePageMeta({
    title: "Connexion à l'administration",
    description:
      "Espace d'administration du Centre Apostolique Vie et Abondance.",
  });

  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const destination = location.state?.from ?? "/admin";

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await signIn({ email, password });

      navigate(destination, { replace: true });
    } catch (caught) {
      setError(
        caught?.message ?? "La connexion n'a pas pu aboutir."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <div className="admin-login__brand">
          <img
            src={logo}
            alt=""
            aria-hidden="true"
          />

          <span>Centre Apostolique Vie et Abondance</span>
        </div>

        <h1>Espace d&apos;administration</h1>

        <p className="admin-login__intro">
          Connectez-vous pour gérer le contenu du site.
        </p>

        {/* Honnêteté envers l'utilisateur : ce n'est pas une sécurité. */}
        <div
          className="admin-login__warning"
          role="note"
        >
          <FaExclamationTriangle aria-hidden="true" />

          <p>
            <strong>Mode démonstration, sans serveur.</strong> Le mot de
            passe n&apos;est pas vérifié et cette connexion ne protège
            aucune donnée : n&apos;importe quelle adresse e-mail ouvre
            l&apos;espace. Les contenus créés restent dans ce navigateur.
          </p>
        </div>

        <form
          className="admin-login__form"
          onSubmit={handleSubmit}
        >
          <div className="admin-login__field">
            <label htmlFor="admin-login-email">
              Adresse e-mail
            </label>

            <input
              id="admin-login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="pasteur@cava.ci"
              required
            />
          </div>

          <div className="admin-login__field">
            <label htmlFor="admin-login-password">
              Mot de passe
            </label>

            <input
              id="admin-login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              aria-describedby="admin-login-password-help"
            />

            <p
              className="admin-login__help"
              id="admin-login-password-help"
            >
              Champ présent pour préfigurer l&apos;écran final : sa valeur
              n&apos;est aujourd&apos;hui ni vérifiée ni enregistrée.
            </p>
          </div>

          {error && (
            <p
              className="admin-login__error"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
          >
            <FaLock aria-hidden="true" />

            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <Link
          to="/"
          className="admin-login__back"
        >
          Retour au site public
        </Link>
      </div>
    </div>
  );
};

export default Login;
