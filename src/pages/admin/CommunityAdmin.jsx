import { useState } from "react";

import { announcements, members } from "../../services/api";

import usePageMeta from "../../hooks/usePageMeta";

import AdminCrud from "../../components/admin/AdminCrud";

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

// Le formulaire demandait un « Nom complet » alors que le modèle exige
// un prénom ET un nom, tous deux obligatoires. L'enregistrement
// echouait donc systématiquement sur « Les données envoyées sont
// invalides ».
const memberFields = [
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
  notes: item?.notes ?? "",
});

const memberColumns = [
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
    name: "date",
    label: "Date de l'annonce",
    type: "date",
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
  { key: "date", label: "Date" },
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

const TABS = [
  { id: "announcements", label: "Annonces" },
  { id: "members", label: "Membres" },
];

const CommunityAdmin = () => {
  usePageMeta({
    title: "Communauté — Administration",
    description:
      "Gestion des membres et des annonces de la communauté CAVA.",
  });

  const [tab, setTab] = useState("announcements");

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
          />
        )}
      </div>
    </div>
  );
};

export default CommunityAdmin;
