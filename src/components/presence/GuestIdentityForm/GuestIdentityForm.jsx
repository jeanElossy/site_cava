import { useState } from "react";
import { UserCheck } from "lucide-react";

import "./GuestIdentityForm.scss";

// Saisie de l'identité réelle du porteur d'un badge invité
// pré-imprimé. Un badge n'est qu'un jeton de comptage : scanné, il
// n'enregistre qu'une identité fictive ("Invité Homme 1"). Ce
// formulaire est ce qui la remplace par une vraie personne — et c'est
// aussi, en pratique, la fiche d'accueil de l'équipe des nouvelles
// âmes, puisque ces trois champs partent tels quels dans le dossier
// SOA (voir VisitorsPanel#startSoaDossier).
//
// Champs volontairement réduits à trois : il est saisi debout, à
// l'accueil, pendant que la personne attend. Le reste de la fiche SOA
// se remplit plus tard, à tête reposée, par l'agent SOA.
//
// Composant partagé par les deux endroits d'où l'identification est
// possible — la bulle de confirmation du scan (identification
// immédiate) et la liste des visiteurs du service (rattrapage d'un
// badge passé sans être identifié).
const GuestIdentityForm = ({
  defaultValues,
  busy = false,
  error = "",
  title = "Qui porte ce badge ?",
  submitLabel = "Enregistrer l'invité",
  cancelLabel = "Plus tard",
  onSubmit,
  onCancel,
}) => {
  const [firstName, setFirstName] = useState(defaultValues?.firstName ?? "");
  const [lastName, setLastName] = useState(defaultValues?.lastName ?? "");
  const [phone, setPhone] = useState(defaultValues?.phone ?? "");

  const complete = firstName.trim() !== "" && lastName.trim() !== "";

  const handleSubmit = (event) => {
    event.preventDefault();

    if (busy || !complete) return;

    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
    });
  };

  return (
    <form className="guest-identity-form" onSubmit={handleSubmit}>
      <p className="guest-identity-form__intro">
        <UserCheck aria-hidden="true" />
        {title}
      </p>

      <input
        type="text"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        placeholder="Prénom de l'invité"
        autoComplete="off"
        disabled={busy}
        autoFocus
      />

      <input
        type="text"
        value={lastName}
        onChange={(event) => setLastName(event.target.value)}
        placeholder="Nom de l'invité"
        autoComplete="off"
        disabled={busy}
      />

      {/* `type="tel"` : ouvre le pavé numérique du téléphone, l'écran
          de badgeage étant utilisé sur mobile. Pas `type="number"`,
          qui refuserait les indicatifs (« +225 … ») et les espaces. */}
      <input
        type="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="Téléphone (facultatif)"
        autoComplete="off"
        disabled={busy}
      />

      {error && <p className="guest-identity-form__error">{error}</p>}

      <div className="guest-identity-form__actions">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        )}

        <button type="submit" disabled={busy || !complete}>
          {busy ? "Enregistrement…" : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default GuestIdentityForm;
