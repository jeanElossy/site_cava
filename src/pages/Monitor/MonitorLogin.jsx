import { useState } from "react";

import { KeyRound, Loader2, LogIn } from "lucide-react";

import { signIn } from "../../services/auth";

import logo from "../../assets/logo/logo_cava.gif";

/**
 * Connexion à l'espace moniteur.
 *
 * MÊME route que l'administration (`/api/auth/login`) : le serveur
 * reconnaît un matricule à sa forme et cherche le compte correspondant.
 * Aucun mécanisme d'authentification n'est dupliqué ici — seule
 * l'apparence change.
 */
const MonitorLogin = ({ onSignedIn }) => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      const result = await signIn({ identifier, password });

      onSignedIn(result);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="monitor-login">
      <form
        className="monitor-login__card"
        onSubmit={submit}
      >
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="monitor-login__logo"
        />

        <h1>Espace moniteur</h1>

        <p className="monitor-login__lede">École du dimanche — CAVA</p>

        {error && (
          <p
            className="monitor-login__error"
            role="alert"
          >
            {error}
          </p>
        )}

        <label className="monitor-login__field">
          <span>Matricule</span>

          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="1ME 19-016 P"
            autoComplete="username"
            autoCapitalize="characters"
            required
          />
        </label>

        <label className="monitor-login__field">
          <span>Mot de passe</span>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button
          type="submit"
          className="monitor-login__submit"
          disabled={busy}
        >
          {busy ? (
            <Loader2
              className="monitor-login__spinner"
              aria-hidden="true"
            />
          ) : (
            <LogIn aria-hidden="true" />
          )}

          {busy ? "Connexion…" : "Se connecter"}
        </button>

        <p className="monitor-login__hint">
          <KeyRound aria-hidden="true" />
          Votre matricule de membre est votre identifiant. Le mot de passe
          vous est remis par l&apos;administration.
        </p>
      </form>
    </main>
  );
};

export default MonitorLogin;
