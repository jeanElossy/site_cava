import { useId, useState } from "react";

import { Check, Send } from "lucide-react";

import { newsletter } from "../../services/api";

import "./NewsletterForm.scss";

// Formulaire d'inscription à la lettre d'information.
//
// Factorisé parce qu'il apparaît à plusieurs endroits du site. Chaque
// copie serait une occasion d'oublier une gestion d'erreur — ou de
// laisser une confirmation s'afficher sans que rien ne soit enregistré,
// ce qui était précisément le défaut du pied de page.
//
// `variant` n'ajuste que l'habillage : le comportement est identique
// partout.
const NewsletterForm = ({
  variant = "light",
  label = "Votre adresse e-mail",
  buttonLabel = "S'abonner",
  compact = false,
}) => {
  const inputId = useId();

  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (busy || !email.trim()) return;

    setBusy(true);
    setError("");

    try {
      await newsletter.subscribe(email.trim());

      setDone(true);
      setEmail("");
    } catch (caught) {
      setError(
        caught?.message ??
          "L'inscription n'a pas abouti. Merci de réessayer."
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p
        className={`newsletter-form__done newsletter-form__done--${variant}`}
        role="status"
      >
        <Check
          size={17}
          aria-hidden="true"
        />

        <span>
          Votre adresse est enregistrée. Vous recevrez nos prochaines
          actualités.
        </span>
      </p>
    );
  }

  return (
    <div
      className={`newsletter-form newsletter-form--${variant}${
        compact ? " newsletter-form--compact" : ""
      }`}
    >
      <form onSubmit={handleSubmit}>
        <label
          className="newsletter-form__label"
          htmlFor={inputId}
        >
          {label}
        </label>

        <input
          id={inputId}
          type="email"
          placeholder="Votre e-mail"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          disabled={busy}
          required
        />

        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          aria-label={buttonLabel}
        >
          {compact ? (
            <Send
              size={18}
              aria-hidden="true"
            />
          ) : (
            <>
              {busy ? "Envoi…" : buttonLabel}

              <Send
                size={16}
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </form>

      {error && (
        <p
          className="newsletter-form__error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default NewsletterForm;
