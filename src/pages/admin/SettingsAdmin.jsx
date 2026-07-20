import { useState } from "react";

import { FaInfoCircle } from "react-icons/fa";

import { settings } from "../../services/api";

import useAsyncData from "../../hooks/useAsyncData";
import usePageMeta from "../../hooks/usePageMeta";

import AdminForm from "../../components/admin/AdminForm";

import {
  AdminError,
  AdminLoading,
} from "../../components/admin/AdminFeedback";

import "./SettingsAdmin.scss";

const FIELDS = [
  {
    name: "churchName",
    label: "Nom de l'église",
    required: true,
    wide: true,
  },
  {
    name: "phonePrimary",
    label: "Téléphone principal",
    type: "tel",
  },
  {
    name: "phoneSecondary",
    label: "Téléphone secondaire",
    type: "tel",
  },
  {
    name: "email",
    label: "Adresse e-mail",
    type: "email",
  },
  {
    name: "serviceHours",
    label: "Horaires d'accueil",
    placeholder: "Lundi - dimanche : 08h00 - 17h00",
  },
  {
    name: "address",
    label: "Adresse postale",
    type: "textarea",
    rows: 2,
    wide: true,
  },
  {
    name: "facebook",
    label: "Facebook",
    type: "url",
    placeholder: "https://facebook.com/…",
  },
  {
    name: "instagram",
    label: "Instagram",
    type: "url",
    placeholder: "https://instagram.com/…",
  },
  {
    name: "youtube",
    label: "YouTube",
    type: "url",
    placeholder: "https://youtube.com/…",
  },
  {
    name: "whatsapp",
    label: "WhatsApp",
    type: "url",
    placeholder: "https://wa.me/225…",
  },
];

const SettingsAdmin = () => {
  usePageMeta({
    title: "Paramètres — Administration",
    description:
      "Coordonnées et réseaux sociaux du Centre Apostolique Vie et Abondance.",
  });

  const { data, loading, error, reload } = useAsyncData(settings.get);

  // `draft` ne contient que les modifications en cours de saisie : tant
  // qu'il est nul, le formulaire affiche directement la donnée chargée.
  // Rien à synchroniser dans un effet.
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [saved, setSaved] = useState(false);

  const values = draft ?? data;

  const handleChange = (name, value) => {
    setSaved(false);
    setDraft((previous) => ({
      ...(previous ?? data),
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    setBusy(true);
    setActionError(null);
    setSaved(false);

    try {
      const next = await settings.save(values);

      setDraft(next);
      setSaved(true);
    } catch (caught) {
      setActionError(
        caught?.message ?? "L'enregistrement a échoué."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-settings">
      <header className="admin-settings__header">
        <h1>Paramètres</h1>

        <p>
          Coordonnées de l&apos;église et liens vers les réseaux sociaux.
        </p>
      </header>

      {/* Ne pas laisser croire que ces champs pilotent déjà le site. */}
      <div
        className="admin-settings__notice"
        role="note"
      >
        <FaInfoCircle aria-hidden="true" />

        <p>
          Ces valeurs sont enregistrées mais ne pilotent pas encore
          l&apos;affichage du site : le pied de page et la page Contact
          affichent toujours des coordonnées écrites en dur dans le code.
          Le branchement se fera en même temps que le backend.
        </p>
      </div>

      <div aria-busy={loading}>
        {loading && (
          <AdminLoading label="Chargement des paramètres…" />
        )}

        {!loading && error && (
          <AdminError
            message={error}
            onRetry={reload}
          />
        )}

        {!loading && !error && values && (
          <div className="admin-settings__panel">
            {saved && (
              <p
                className="admin-settings__saved"
                role="status"
                aria-live="polite"
              >
                Paramètres enregistrés dans ce navigateur.
              </p>
            )}

            <AdminForm
              fields={FIELDS}
              values={values}
              onChange={handleChange}
              onSubmit={handleSubmit}
              submitLabel="Enregistrer les paramètres"
              busy={busy}
              error={actionError}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsAdmin;
