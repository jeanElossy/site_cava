import { useState } from "react";

import { Loader2, ShieldCheck } from "lucide-react";

import { changeFirstPassword } from "../../services/auth";

/**
 * Changement obligatoire d'un mot de passe temporaire.
 *
 * Cet écran n'est pas une simple invitation : tant qu'il n'est pas
 * franchi, le serveur n'a délivré AUCUN jeton de session (voir
 * auth.service.js#completeLogin). Il n'y a donc rien à contourner —
 * fermer la page et revenir ramène ici.
 */
const MonitorFirstPassword = ({ pending, onChanged, onCancel }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    // Vérifié ici ET côté serveur : ce contrôle-ci évite un
    // aller-retour, il ne remplace pas l'autre.
    if (newPassword !== confirmation) {
      setError("Les deux mots de passe ne sont pas identiques.");

      return;
    }

    setBusy(true);
    setError("");

    try {
      const result = await changeFirstPassword({
        changeToken: pending.changeToken,
        currentPassword,
        newPassword,
      });

      onChanged(result);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  const firstName = pending?.user?.name?.split(" ")[0] ?? "";

  return (
    <main className="monitor-login">
      <form
        className="monitor-login__card"
        onSubmit={submit}
      >
        <span
          className="monitor-login__seal"
          aria-hidden="true"
        >
          <ShieldCheck />
        </span>

        <h1>Choisissez votre mot de passe</h1>

        <p className="monitor-login__lede">
          {firstName ? `Bonjour ${firstName}. ` : ""}
          Votre mot de passe actuel est temporaire : il est connu de
          l&apos;administration. Choisissez-en un que vous serez seul à
          connaître.
        </p>

        {error && (
          <p
            className="monitor-login__error"
            role="alert"
          >
            {error}
          </p>
        )}

        <label className="monitor-login__field">
          <span>Mot de passe temporaire</span>

          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <label className="monitor-login__field">
          <span>Nouveau mot de passe</span>

          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
          />
        </label>

        <label className="monitor-login__field">
          <span>Confirmation</span>

          <input
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
          />
        </label>

        <p className="monitor-login__hint">
          12 caractères minimum. Choisissez quelque chose dont vous vous
          souviendrez : personne ne pourra vous le rappeler, il faudra le
          réinitialiser.
        </p>

        <button
          type="submit"
          className="monitor-login__submit"
          disabled={busy}
        >
          {busy && (
            <Loader2
              className="monitor-login__spinner"
              aria-hidden="true"
            />
          )}

          {busy ? "Enregistrement…" : "Modifier le mot de passe"}
        </button>

        <button
          type="button"
          className="monitor-login__link"
          onClick={onCancel}
        >
          Annuler et revenir à la connexion
        </button>
      </form>
    </main>
  );
};

export default MonitorFirstPassword;
