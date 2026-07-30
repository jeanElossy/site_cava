import { useState } from "react";

import { Download } from "lucide-react";

import {
  announcements,
  members,
  flocks as flocksApi,
} from "../../services/api";
import { apiBaseUrl, getToken } from "../../services/http";

import usePageMeta from "../../hooks/usePageMeta";
import useAsyncData from "../../hooks/useAsyncData";

import AdminCrud from "../../components/admin/AdminCrud";
import SubmissionsPanel from "../../components/admin/SubmissionsPanel";

import { CHURCHES, churchLabel, GENDERS, MARITAL_STATUSES } from "../../components/registration/RegistrationForm/data";
import {
  formatRegistrationNumber,
  compareByRegistrationOrder,
} from "../../utils/registrationNumber";

import "./CommunityAdmin.scss";

const ANNOUNCEMENT_CATEGORIES = [
  { value: "info", label: "Information" },
  { value: "priere", label: "Prière" },
  { value: "evenement", label: "Événement" },
  { value: "service", label: "Service" },
];

const CATEGORY_LABELS = ANNOUNCEMENT_CATEGORIES.reduce(
  (accumulator, item) => {
    accumulator[item.value] = item.label;

    return accumulator;
  },
  {}
);

// Ces valeurs ne sont pas décoratives : elles reprennent exactement les
// énumérations du modèle Member. Un rôle saisi librement était refusé à
// l'enregistrement, sans que le formulaire l'explique.
const MEMBER_ROLES = [
  { value: "membre", label: "Membre" },
  { value: "serviteur", label: "Serviteur" },
  { value: "responsable", label: "Responsable" },
];

const MEMBER_STATUSES = [
  { value: "actif", label: "Actif" },
  { value: "inactif", label: "Inactif" },
];

const FLOCK_STATUSES = [
  { value: "published", label: "Active" },
  { value: "draft", label: "Brouillon" },
  { value: "archived", label: "Archivée" },
];

const FLOCK_STATUS_LABELS = Object.fromEntries(
  FLOCK_STATUSES.map((item) => [item.value, item.label])
);

const flockFields = [
  {
    name: "code",
    label: "Code (2 lettres)",
    required: true,
    placeholder: "OL",
  },
  { name: "name", label: "Nom de la bergerie", required: true },
  {
    name: "church",
    label: "Église",
    type: "select",
    required: true,
    options: CHURCHES.map((church) => ({
      value: String(church.value),
      label: church.label,
    })),
  },
  {
    name: "status",
    label: "Statut",
    type: "select",
    options: FLOCK_STATUSES,
  },
];

const flockColumns = [
  { key: "code", label: "Code" },
  { key: "name", label: "Nom" },
  {
    key: "church",
    label: "Église",
    render: (item) => churchLabel(item.church),
  },
  {
    key: "status",
    label: "Statut",
    render: (item) => FLOCK_STATUS_LABELS[item.status] ?? item.status,
  },
];

const flockToValues = (item) => ({
  code: item?.code ?? "",
  name: item?.name ?? "",
  church: item?.church ? String(item.church) : "",
  status: item?.status ?? "published",
});

const flockToPayload = (values) => ({
  code: values.code.trim().toUpperCase(),
  name: values.name.trim(),
  church: Number(values.church),
  status: values.status || "published",
});

// Le formulaire demandait un « Nom complet » alors que le modèle exige
// un prénom ET un nom, tous deux obligatoires. L'enregistrement
// echouait donc systématiquement sur « Les données envoyées sont
// invalides ».
const buildMemberFields = (flockOptions) => [
  {
    name: "firstName",
    label: "Prénom",
    required: true,
  },
  {
    name: "lastName",
    label: "Nom",
    required: true,
  },
  {
    name: "email",
    label: "Adresse e-mail",
    type: "email",
  },
  {
    name: "phone",
    label: "Téléphone",
    type: "tel",
    placeholder: "+225 07 00 00 00 00",
  },
  {
    // Le modèle nomme ce champ `area`.
    name: "area",
    label: "Quartier / groupe de maison",
    placeholder: "Angré Château",
  },
  {
    name: "role",
    label: "Rôle",
    type: "select",
    options: MEMBER_ROLES,
  },
  {
    name: "status",
    label: "Statut",
    type: "select",
    options: MEMBER_STATUSES,
  },
  {
    name: "joinedAt",
    label: "Date d'arrivée",
    type: "date",
  },
  {
    name: "registrationNumber",
    label: "Matricule",
    placeholder: "1OL16005E (facultatif)",
    help: "Laissez vide pour les membres inscrits depuis le site : le matricule est alors attribué automatiquement à la validation de leur inscription.",
  },
  {
    name: "church",
    label: "Église",
    type: "select",
    options: CHURCHES.map((church) => ({
      value: String(church.value),
      label: church.label,
    })),
  },
  {
    name: "flock",
    label: "Bergerie",
    type: "select",
    options: flockOptions,
  },
  { name: "whatsapp", label: "WhatsApp", type: "tel" },
  { name: "address", label: "Adresse", wide: true },
  { name: "dateOfBirth", label: "Date de naissance", type: "date" },
  {
    name: "gender",
    label: "Genre",
    type: "select",
    options: GENDERS,
  },
  {
    name: "maritalStatus",
    label: "Situation matrimoniale",
    type: "select",
    options: MARITAL_STATUSES,
  },
  { name: "childrenCount", label: "Nombre d'enfants", type: "number" },
  { name: "conversionYear", label: "Année de conversion", type: "number" },
  {
    name: "baptismWater",
    type: "checkbox",
    label: "Baptisé(e) d'eau",
  },
  {
    name: "baptismWaterYear",
    label: "Année du baptême d'eau",
    type: "number",
  },
  {
    name: "baptismHolySpirit",
    type: "checkbox",
    label: "Baptisé(e) du Saint-Esprit",
  },
  { name: "previousChurch", label: "Église précédente" },
  { name: "profession", label: "Profession" },
  { name: "skills", label: "Compétences (séparées par des virgules)" },
  { name: "desiredDepartment", label: "Département souhaité" },
  { name: "availability", label: "Disponibilités", wide: true },
  {
    name: "emergencyContactName",
    label: "Contact d'urgence — nom",
  },
  {
    name: "emergencyContactPhone",
    label: "Contact d'urgence — téléphone",
    type: "tel",
  },
  {
    name: "notes",
    label: "Notes internes",
    type: "textarea",
    wide: true,
    rows: 3,
    help: "Visible uniquement dans cette administration, jamais sur le site public.",
  },
];

const ROLE_LABELS = Object.fromEntries(
  MEMBER_ROLES.map((item) => [item.value, item.label])
);

// Un `<input type="date">` n'accepte QUE le format AAAA-MM-JJ. La base
// renvoie une date ISO complète ("2026-07-21T00:00:00.000Z") : sans
// cette coupe, le champ s'affichait vide à la modification et la date
// d'arrivée se perdait au premier enregistrement.
const toDateInput = (value) =>
  typeof value === "string" ? value.slice(0, 10) : "";

const memberToValues = (item) => ({
  firstName: item?.firstName ?? "",
  lastName: item?.lastName ?? "",
  email: item?.email ?? "",
  phone: item?.phone ?? "",
  area: item?.area ?? "",
  // Valeurs par défaut alignées sur celles du modèle, pour qu'une
  // création sans choix explicite reste valide.
  role: item?.role ?? "membre",
  status: item?.status ?? "actif",
  joinedAt: toDateInput(item?.joinedAt),
  registrationNumber: item?.registrationNumber ?? "",
  church: item?.church ? String(item.church) : "",
  flock: item?.flock?.id ?? item?.flock ?? "",
  whatsapp: item?.whatsapp ?? "",
  address: item?.address ?? "",
  dateOfBirth: toDateInput(item?.dateOfBirth),
  gender: item?.gender ?? "",
  maritalStatus: item?.maritalStatus ?? "",
  childrenCount: item?.childrenCount ?? "",
  conversionYear: item?.conversionYear ?? "",
  baptismWater: Boolean(item?.baptism?.water),
  baptismWaterYear: item?.baptism?.waterYear ?? "",
  baptismHolySpirit: Boolean(item?.baptism?.holySpirit),
  previousChurch: item?.previousChurch ?? "",
  profession: item?.profession ?? "",
  skills: Array.isArray(item?.skills) ? item.skills.join(", ") : "",
  desiredDepartment: item?.desiredDepartment ?? "",
  availability: item?.availability ?? "",
  emergencyContactName: item?.emergencyContact?.name ?? "",
  emergencyContactPhone: item?.emergencyContact?.phone ?? "",
  notes: item?.notes ?? "",
});

const memberToPayload = (values) => ({
  firstName: values.firstName.trim(),
  lastName: values.lastName.trim(),
  email: values.email.trim() || undefined,
  phone: values.phone.trim() || undefined,
  area: values.area.trim() || undefined,
  role: values.role || "membre",
  status: values.status || "actif",
  joinedAt: values.joinedAt || undefined,
  registrationNumber: values.registrationNumber.trim() || undefined,
  church: values.church ? Number(values.church) : undefined,
  flock: values.flock || undefined,
  whatsapp: values.whatsapp.trim() || undefined,
  address: values.address.trim() || undefined,
  dateOfBirth: values.dateOfBirth || undefined,
  gender: values.gender || undefined,
  maritalStatus: values.maritalStatus || undefined,
  childrenCount:
    values.childrenCount !== "" ? Number(values.childrenCount) : undefined,
  conversionYear:
    values.conversionYear !== "" ? Number(values.conversionYear) : undefined,
  baptism: {
    water: Boolean(values.baptismWater),
    waterYear:
      values.baptismWaterYear !== ""
        ? Number(values.baptismWaterYear)
        : undefined,
    holySpirit: Boolean(values.baptismHolySpirit),
  },
  previousChurch: values.previousChurch.trim() || undefined,
  profession: values.profession.trim() || undefined,
  skills: values.skills
    ? values.skills
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [],
  desiredDepartment: values.desiredDepartment.trim() || undefined,
  availability: values.availability.trim() || undefined,
  emergencyContact: {
    name: values.emergencyContactName.trim() || undefined,
    phone: values.emergencyContactPhone.trim() || undefined,
  },
  notes: values.notes,
});

const memberColumns = [
  {
    key: "registrationNumber",
    label: "Matricule",
    render: (item) =>
      item.registrationNumber
        ? formatRegistrationNumber(item.registrationNumber)
        : "—",
  },
  {
    key: "name",
    label: "Membre",
    render: (item) =>
      [item.firstName, item.lastName].filter(Boolean).join(" ") ||
      "—",
  },
  { key: "area", label: "Quartier / groupe" },
  {
    key: "role",
    label: "Rôle",
    render: (item) => (
      <span className="admin-crud__pill">
        {ROLE_LABELS[item.role] ?? "—"}
      </span>
    ),
  },
  { key: "phone", label: "Téléphone" },
  {
    key: "status",
    label: "Statut",
    render: (item) =>
      item.status === "inactif" ? (
        <span className="admin-crud__muted">Inactif</span>
      ) : (
        "Actif"
      ),
  },
];

const announcementFields = [
  {
    name: "title",
    label: "Titre de l'annonce",
    required: true,
    wide: true,
  },
  {
    name: "category",
    label: "Catégorie",
    type: "select",
    options: ANNOUNCEMENT_CATEGORIES,
    required: true,
  },
  {
    // Le modele nomme ce champ `publishedAt`. Envoye sous le nom
    // « date », il etait ignore en silence et l'annonce prenait la date
    // du jour.
    name: "date",
    label: "Date de publication",
    type: "date",
  },
  {
    name: "expiresAt",
    label: "Date d'expiration",
    type: "date",
    help: "Facultatif. Passé cette date, l'annonce disparaît du site sans intervention.",
  },
  {
    name: "body",
    label: "Contenu",
    type: "textarea",
    wide: true,
    rows: 5,
    help: "Texte affiché sur la page Communauté du site public.",
  },
  {
    name: "pinned",
    type: "checkbox",
    label: "Épingler en tête de liste",
  },
];

const announcementColumns = [
  { key: "title", label: "Annonce" },
  {
    key: "category",
    label: "Catégorie",
    render: (item) => (
      <span className="admin-crud__pill">
        {CATEGORY_LABELS[item.category] ?? "—"}
      </span>
    ),
  },
  {
    key: "publishedAt",
    label: "Publiée le",
    render: (item) =>
      item.publishedAt
        ? new Date(item.publishedAt).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })
        : "—",
  },
  {
    key: "pinned",
    label: "Épinglée",
    render: (item) =>
      item.pinned ? (
        "Oui"
      ) : (
        <span className="admin-crud__muted">Non</span>
      ),
  },
];

const MemberExportButtons = ({ flockOptions }) => {
  const [filters, setFilters] = useState({ church: "", flock: "", status: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // L'export passe par `fetch` plutôt qu'un simple lien : la route est
  // protégée, et un `<a href>` n'emporte pas l'en-tête d'autorisation
  // (même mécanisme que l'export CSV de la lettre d'information).
  const download = async (kind) => {
    setBusy(kind);
    setError("");

    try {
      const query = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== "")
        )
      );

      const response = await fetch(
        `${apiBaseUrl}/api/admin/members/export.${kind}?${query}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      if (!response.ok) {
        throw new Error(`L'export a échoué (code ${response.status}).`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download =
        kind === "xlsx" ? "membres-cava.xlsx" : "registre-membres-cava.pdf";
      link.click();

      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught?.message ?? "L'export a échoué.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="admin-community__export">
      <select
        aria-label="Filtrer par église"
        value={filters.church}
        onChange={(event) =>
          setFilters((previous) => ({ ...previous, church: event.target.value }))
        }
      >
        <option value="">Toutes les églises</option>
        {CHURCHES.map((church) => (
          <option key={church.value} value={church.value}>
            {church.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrer par bergerie"
        value={filters.flock}
        onChange={(event) =>
          setFilters((previous) => ({ ...previous, flock: event.target.value }))
        }
      >
        <option value="">Toutes les bergeries</option>
        {flockOptions.map((flock) => (
          <option key={flock.value} value={flock.value}>
            {flock.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrer par statut"
        value={filters.status}
        onChange={(event) =>
          setFilters((previous) => ({ ...previous, status: event.target.value }))
        }
      >
        <option value="">Tous les statuts</option>
        <option value="actif">Actif</option>
        <option value="inactif">Inactif</option>
      </select>

      <button type="button" onClick={() => download("xlsx")} disabled={busy !== ""}>
        <Download aria-hidden="true" />
        {busy === "xlsx" ? "Export…" : "Excel"}
      </button>

      <button type="button" onClick={() => download("pdf")} disabled={busy !== ""}>
        <Download aria-hidden="true" />
        {busy === "pdf" ? "Export…" : "PDF"}
      </button>

      {error && (
        <p className="admin-community__alert" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

const TABS = [
  { id: "announcements", label: "Annonces" },
  { id: "members", label: "Membres" },
  { id: "flocks", label: "Bergeries" },
  { id: "submissions", label: "Inscriptions" },
];

const CommunityAdmin = () => {
  usePageMeta({
    title: "Communauté — Administration",
    description:
      "Gestion des membres et des annonces de la communauté CAVA.",
  });

  const [tab, setTab] = useState("announcements");

  const { data: flockList } = useAsyncData(flocksApi.listAdmin);

  const flockOptions = (flockList ?? []).map((flock) => ({
    value: flock.id,
    label: `${flock.name} (${churchLabel(flock.church)})`,
  }));

  const memberFields = buildMemberFields(flockOptions);

  return (
    <div className="admin-community">
      <div
        className="admin-community__tabs"
        role="tablist"
        aria-label="Sections de la communauté"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`admin-community-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`admin-community-panel-${item.id}`}
            className={
              tab === item.id
                ? "admin-community__tab admin-community__tab--active"
                : "admin-community__tab"
            }
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="admin-community-panel-announcements"
        aria-labelledby="admin-community-tab-announcements"
        hidden={tab !== "announcements"}
      >
        {tab === "announcements" && (
          <AdminCrud
            resource={announcements}
            fields={announcementFields}
            columns={announcementColumns}
            labels={{
              singular: "une annonce",
              plural: "Annonces de la communauté",
              add: "Publier une annonce",
              empty:
                "Aucune annonce publiée. Les annonces créées ici apparaissent immédiatement sur la page Communauté du site.",
              loadingSuffix: "des annonces",
              description:
                "Ces annonces sont publiées sur la page Communauté du site public.",
              titleKey: "title",
            }}
            toValues={(item) => ({
              title: item?.title ?? "",
              category: item?.category ?? "info",
              date: toDateInput(item?.publishedAt),
              expiresAt: toDateInput(item?.expiresAt),
              body: item?.body ?? "",
              pinned: Boolean(item?.pinned),
            })}
            toPayload={(values) => ({
              title: values.title.trim(),
              category: values.category || "info",
              publishedAt: values.date || undefined,
              // `null` et non `undefined` : `undefined` laisserait une
              // date d'expiration précédente en place au lieu de la
              // retirer.
              expiresAt: values.expiresAt || null,
              body: values.body.trim(),
              pinned: Boolean(values.pinned),
            })}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="admin-community-panel-members"
        aria-labelledby="admin-community-tab-members"
        hidden={tab !== "members"}
      >
        {tab === "members" && (
          <>
            <MemberExportButtons flockOptions={flockOptions} />

            <AdminCrud
              resource={members}
              fields={memberFields}
              columns={memberColumns}
              labels={{
                singular: "un membre",
                plural: "Membres",
                add: "Ajouter un membre",
                empty:
                  "Aucun membre enregistré. Cette liste sert au suivi interne et n'est pas publiée sur le site.",
                loadingSuffix: "des membres",
                description:
                  "Annuaire interne des membres. Ces informations ne sont jamais affichées sur le site public.",
                titleKey: "lastName",
              }}
              toValues={memberToValues}
              toPayload={memberToPayload}
              sortItems={(items) => [...items].sort(compareByRegistrationOrder)}
            />
          </>
        )}
      </div>

      <div
        role="tabpanel"
        id="admin-community-panel-flocks"
        aria-labelledby="admin-community-tab-flocks"
        hidden={tab !== "flocks"}
      >
        {tab === "flocks" && (
          <AdminCrud
            resource={flocksApi}
            fields={flockFields}
            columns={flockColumns}
            labels={{
              singular: "une bergerie",
              plural: "Bergeries",
              add: "Ajouter une bergerie",
              empty:
                "Aucune bergerie enregistrée. Elles alimentent la liste déroulante du formulaire d'inscription et de la fiche membre.",
              loadingSuffix: "des bergeries",
              description:
                "Chaque membre appartient à une bergerie, rattachée à une église.",
              titleKey: "name",
            }}
            toValues={flockToValues}
            toPayload={flockToPayload}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="admin-community-panel-submissions"
        aria-labelledby="admin-community-tab-submissions"
        hidden={tab !== "submissions"}
      >
        {tab === "submissions" && <SubmissionsPanel />}
      </div>
    </div>
  );
};

export default CommunityAdmin;
