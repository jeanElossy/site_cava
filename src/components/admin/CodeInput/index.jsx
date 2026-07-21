import { useEffect, useMemo, useRef } from "react";

import "./CodeInput.scss";

// Saisie d'un code à 6 chiffres, une case par chiffre.
//
// Pourquoi pas un simple `<input>` : sur mobile, un champ unique
// affiche souvent le mauvais clavier et n'indique pas combien de
// chiffres sont attendus. Les cases séparées rendent la longueur
// évidente et permettent de corriger un chiffre sans tout retaper.
//
// Le collage est géré explicitement : c'est le geste le plus courant
// sur ordinateur, où le code vient d'un gestionnaire de mots de passe.
// Valeurs par défaut dans la signature : `defaultProps` est ignoré sur
// les composants fonction depuis React 19.
const CodeInput = ({
  value = "",
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = false,
  invalid = false,
  label = "Code de vérification",
}) => {
  const inputsRef = useRef([]);

  const digits = useMemo(() => {
    const clean = String(value ?? "")
      .replace(/\D/g, "")
      .slice(0, length);

    return Array.from(
      { length },
      (_unused, index) => clean[index] ?? ""
    );
  }, [value, length]);

  useEffect(() => {
    if (autoFocus) inputsRef.current[0]?.focus();
  }, [autoFocus]);

  const push = (next) => {
    const joined = next.join("").slice(0, length);

    onChange(joined);

    if (joined.length === length) onComplete?.(joined);
  };

  const focusAt = (index) => {
    const target = inputsRef.current[
      Math.max(0, Math.min(length - 1, index))
    ];

    target?.focus();
    target?.select();
  };

  const handleChange = (index) => (event) => {
    const typed = event.target.value.replace(/\D/g, "");

    if (!typed) return;

    const next = [...digits];

    // Saisie rapide : si l'utilisateur tape plusieurs chiffres d'un
    // coup (clavier mobile, autoremplissage), on les répartit sur les
    // cases suivantes au lieu de n'en garder qu'un.
    for (
      let offset = 0;
      offset < typed.length && index + offset < length;
      offset += 1
    ) {
      next[index + offset] = typed[offset];
    }

    push(next);

    focusAt(index + typed.length);
  };

  const handleKeyDown = (index) => (event) => {
    if (event.key === "Backspace") {
      event.preventDefault();

      const next = [...digits];

      if (next[index]) {
        // Efface le chiffre de la case courante.
        next[index] = "";

        push(next);
      } else if (index > 0) {
        // Case déjà vide : on remonte et on efface la précédente.
        next[index - 1] = "";

        push(next);

        focusAt(index - 1);
      }

      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();

      focusAt(index - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();

      focusAt(index + 1);
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();

    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);

    if (!pasted) return;

    const next = Array.from(
      { length },
      (_unused, index) => pasted[index] ?? ""
    );

    push(next);

    focusAt(pasted.length);
  };

  return (
    <div
      className={`admin-code-input${
        invalid ? " admin-code-input--invalid" : ""
      }`}
      role="group"
      aria-label={label}
    >
      {digits.map((digit, index) => (
        <input
          // Les cases sont positionnelles et de nombre fixe : l'index
          // est ici un identifiant stable, pas un pis-aller.
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          // `one-time-code` : iOS et Android proposent alors le code
          // reçu, et les gestionnaires de mots de passe le remplissent.
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          value={digit}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          aria-label={`Chiffre ${index + 1} sur ${length}`}
        />
      ))}
    </div>
  );
};

export default CodeInput;
