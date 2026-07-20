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

const memberFields = [
  {
    name: "fullName",
    label: "Nom complet",
    required: true,
    wide: true,
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
    name: "group",
    label: "Groupe de maison",
    placeholder: "Angré Château",
  },
  {
    name: "role",
    label: "Rôle / service",
    placeholder: "Accueil, louange…",
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

const memberColumns = [
  { key: "fullName", label: "Membre" },
  { key: "group", label: "Groupe de maison" },
  { key: "role", label: "Rôle" },
  { key: "phone", label: "Téléphone" },
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
              titleKey: "fullName",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default CommunityAdmin;
