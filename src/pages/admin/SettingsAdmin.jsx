import { useState } from "react";

import { FaInfoCircle } from "react-icons/fa";

import { settings } from "../../services/api";

import useAsyncData from "../../hooks/useAsyncData";
import usePageMeta from "../../hooks/usePageMeta";

import AdminForm from "../../components/admin/AdminForm";
import TwoFactorPanel from "../../components/admin/TwoFactorPanel";

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
    // Le formulaire proposait un champ texte « serviceHours ». Deux
    // erreurs : le modèle nomme ce champ `serviceTimes`, et ce n'est
    // pas une chaîne mais une LISTE d'horaires récurrents, chacun avec
    // son jour et son intitulé. La valeur saisie était donc perdue.
    name: "serviceTimes",
    label: "Horaires réguliers",
    type: "repeater",
    max: 12,
    itemLabel: "Horaire",
    addLabel: "Ajouter un horaire",
    emptyText:
      "Aucun horaire enregistré. Il s'agit des rendez-vous récurrents (culte du dimanche, réunion de prière…), distincts des événements datés.",
    wide: true,
    fields: [
      {
        name: "label",
        label: "Intitulé",
        placeholder: "Culte dominical",
      },
      {
        name: "day",
        label: "Jour",
        type: "select",
        options: [
          { value: "lundi", label: "Lundi" },
          { value: "mardi", label: "Mardi" },
          { value: "mercredi", label: "Mercredi" },
          { value: "jeudi", label: "Jeudi" },
          { value: "vendredi", label: "Vendredi" },
          { value: "samedi", label: "Samedi" },
          { value: "dimanche", label: "Dimanche" },
        ],
      },
      {
        name: "time",
        label: "Heure",
        placeholder: "09h00",
      },
      {
        name: "description",
        label: "Précision",
        type: "textarea",
        rows: 2,
        wide: true,
        placeholder: "Facultatif : public concerné, lieu particulier…",
      },
    ],
  },
  {
    name: "address",
    label: "Adresse postale",
    type: "textarea",
    rows: 2,
    wide: true,
  },
  {
    name: "social.facebook",
    label: "Facebook",
    type: "url",
    placeholder: "https://facebook.com/…",
  },
  {
    name: "social.instagram",
    label: "Instagram",
    type: "url",
    placeholder: "https://instagram.com/…",
  },
  {
    name: "social.youtube",
    label: "YouTube",
    type: "url",
    placeholder: "https://youtube.com/…",
  },
  {
    name: "social.whatsapp",
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

  const stored = draft ?? data;

  // AdminForm lit `values[field.name]` : un nom pointé ("social.facebook")
  // n'y correspondrait à rien. On expose donc une vue aplatie.
  const values = stored
    ? {
        ...stored,
        // Le champ répétable attend un tableau : `undefined` le ferait
        // planter au premier rendu.
        serviceTimes: stored.serviceTimes ?? [],
        "social.facebook": stored.social?.facebook ?? "",
        "social.instagram": stored.social?.instagram ?? "",
        "social.youtube": stored.social?.youtube ?? "",
        "social.whatsapp": stored.social?.whatsapp ?? "",
      }
    : stored;

  // Les liens de réseaux sociaux vivent sous `social.*` dans le
  // modèle. Le formulaire les envoyait à plat (`facebook`, `instagram`…)
  // et Mongoose les ignorait : la section entière était perdue à chaque
  // enregistrement, sans le moindre message.
  const handleChange = (name, value) => {
    setSaved(false);

    setDraft((previous) => {
      const base = previous ?? data ?? {};

      if (!name.includes(".")) {
        return { ...base, [name]: value };
      }

      const [parent, child] = name.split(".");

      return {
        ...base,
        [parent]: { ...(base[parent] ?? {}), [child]: value },
      };
    });
  };

  const handleSubmit = async () => {
    setBusy(true);
    setActionError(null);
    setSaved(false);

    try {
      const next = await settings.save(stored);

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
          Ces valeurs sont bien enregistrées en base, mais ne pilotent
          pas encore l&apos;affichage du site : le pied de page et la
          page Contact affichent toujours des coordonnées écrites en
          dur dans le code. Leur branchement reste à faire.
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
                Paramètres enregistrés.
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

      {/* Indépendant des paramètres du site : le panneau gère son
          propre chargement et n'est pas concerné par l'échec éventuel
          de `settings.get`. */}
      <TwoFactorPanel />
    </div>
  );
};

export default SettingsAdmin;
