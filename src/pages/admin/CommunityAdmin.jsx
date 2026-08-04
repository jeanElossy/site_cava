import { useEffect, useRef, useState } from "react";

import {
  Download,
  IdCard,
  MoreVertical,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";

import {
  announcements,
  members,
  flocks as flocksApi,
  churches as churchesApi,
} from "../../services/api";
import { apiBaseUrl, getToken } from "../../services/http";

import usePageMeta from "../../hooks/usePageMeta";
import useAsyncData from "../../hooks/useAsyncData";
import usePendingSubmissionsCount from "../../hooks/usePendingSubmissionsCount";
import useMembersCount from "../../hooks/useMembersCount";

import AdminCrud from "../../components/admin/AdminCrud";
import SubmissionsPanel from "../../components/admin/SubmissionsPanel";

import { churchLabelFrom, GENDERS, MARITAL_STATUSES } from "../../components/registration/RegistrationForm/data";
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
  { value: "pasteur", label: "Pasteur" },
  { value: "chantre", label: "Chantre" },
  { value: "dirigeant", label: "Dirigeant" },
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

// Les champs/colonnes qui dépendent de la liste des églises (chargée
// depuis l'API) sont construits par une fonction plutôt que déclarés
// une fois pour toutes au niveau du module — voir `buildMemberFields`
// pour la même raison.
const buildFlockFields = (churchSelectOptions) => [
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
    options: churchSelectOptions,
  },
  {
    name: "status",
    label: "Statut",
    type: "select",
    options: FLOCK_STATUSES,
  },
];

const buildFlockColumns = (churchOptions) => [
  { key: "code", label: "Code" },
  { key: "name", label: "Nom" },
  {
    key: "church",
    label: "Église",
    render: (item) => churchLabelFrom(churchOptions, item.church),
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
const buildMemberFields = (flockOptions, churchSelectOptions) => [
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
    name: "photo",
    label: "Photo",
    type: "upload",
    folder: "members",
    accept: "image",
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
    // Le modèle ne porte qu'une date (`joinedAt`) ; comme sur le
    // formulaire public d'inscription, on ne redemande que l'année —
    // le jour et le mois exacts d'arrivée ne sont jamais connus pour
    // la grande majorité des membres.
    name: "arrivalYear",
    label: "Année d'arrivée",
    type: "number",
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
    options: churchSelectOptions,
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
  photo: item?.photo ?? "",
  email: item?.email ?? "",
  phone: item?.phone ?? "",
  area: item?.area ?? "",
  // Valeurs par défaut alignées sur celles du modèle, pour qu'une
  // création sans choix explicite reste valide.
  role: item?.role ?? "membre",
  status: item?.status ?? "actif",
  arrivalYear: item?.joinedAt
    ? String(new Date(item.joinedAt).getFullYear())
    : "",
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
  photo: values.photo || undefined,
  email: values.email.trim() || undefined,
  phone: values.phone.trim() || undefined,
  area: values.area.trim() || undefined,
  role: values.role || "membre",
  status: values.status || "actif",
  joinedAt: values.arrivalYear !== "" ? `${values.arrivalYear}-01-01` : undefined,
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

// Un membre saisit son nom dans la casse qui lui vient — la liste le
// normalise à l'affichage plutôt que de reproduire un mélange
// majuscules/minuscules incohérent d'une ligne à l'autre : prénom en
// casse de titre (chaque mot, y compris après un trait d'union),
// nom de famille intégralement en majuscules, convention courante
// des documents administratifs.
const toTitleCase = (value = "") =>
  value
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (match) => match.toUpperCase());

// Deux boutons de téléchargement par ligne de membre (PDF / JPEG) :
// composant dédié avec son propre état `busy`/`error`, plutôt que de
// la logique inline dans `render()` — potentiellement des dizaines de
// lignes affichées à la fois. Même pattern `fetch` protégé que
// `MemberExportButtons` ci-dessous (la route exige un jeton, un simple
// `<a href>` ne l'emporterait pas).
// Un seul déclencheur (icône « ⋮ ») par ligne plutôt que quatre
// boutons alignés (Modifier, Supprimer, Carte PDF, Carte JPEG) : ça
// libère la place que réclament les autres colonnes. Reçoit
// `onEdit`/`onDelete` de AdminCrud (via la prop `rowActions`) pour ne
// pas dupliquer sa logique d'édition/suppression.
const MemberRowMenu = ({ member, onEdit, onDelete, reload, onStatusChanged }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const containerRef = useRef(null);

  const isInactive = member.status === "inactif";

  const toggleStatus = async () => {
    setBusy("status");
    setError("");

    try {
      await members.update(member.id, {
        status: isInactive ? "actif" : "inactif",
      });

      reload?.();
      // Distinct de `reload` : celui-ci rafraîchit la LISTE affichée,
      // `onStatusChanged` le compteur du badge d'onglet — deux données
      // chargées séparément (voir useMembersCount), toutes deux
      // périmées par ce changement.
      onStatusChanged?.();
      setOpen(false);
    } catch (caught) {
      setError(caught?.message ?? "Le changement de statut a échoué.");
    } finally {
      setBusy("");
    }
  };

  // Ferme le menu au clic en dehors — comportement attendu d'un menu
  // déroulant, qu'aucun composant du projet ne fournissait encore.
  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () =>
      document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const memberLabel =
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    "ce membre";

  // Un seul format proposé : le PDF (recto+verso) sert aussi bien à
  // l'impression qu'à être gardé sur le téléphone comme version
  // numérique — pas de JPEG recto/verso séparés.
  const download = async (kind) => {
    setBusy(kind);
    setError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/admin/members/${member.id}/card.pdf`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      if (!response.ok) {
        throw new Error(
          `Le téléchargement de la carte a échoué (code ${response.status}).`
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `carte-membre-${member.id}.pdf`;
      link.click();

      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (caught) {
      setError(caught?.message ?? "Le téléchargement de la carte a échoué.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="admin-community__row-menu" ref={containerRef}>
      <button
        type="button"
        className="admin-community__row-menu-trigger"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions : ${memberLabel}`}
      >
        <MoreVertical aria-hidden="true" />
      </button>

      {open && (
        <div className="admin-community__row-menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Pencil aria-hidden="true" />
            Voir / modifier
          </button>

          {/* Carte désactivée pour un membre inactif : même fichier
              que le registre exporté, jamais émis pour un membre
              désactivé (voir memberCardSvg.service.js). Un seul bouton
              (PDF recto+verso) : il sert aussi bien à l'impression
              qu'à être gardé sur le téléphone comme version numérique
              — pas besoin des JPEG recto/verso séparés. */}
          {member.registrationNumber && !isInactive && (
            <button
              type="button"
              role="menuitem"
              onClick={() => download("pdf")}
              disabled={busy !== ""}
            >
              <IdCard aria-hidden="true" />
              {busy === "pdf" ? "Téléchargement…" : "Carte imprimable (PDF)"}
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={toggleStatus}
            disabled={busy !== ""}
          >
            {isInactive ? (
              <UserCheck aria-hidden="true" />
            ) : (
              <UserX aria-hidden="true" />
            )}
            {busy === "status"
              ? "Mise à jour…"
              : isInactive
                ? "Réactiver"
                : "Désactiver"}
          </button>

          <button
            type="button"
            role="menuitem"
            className="admin-community__row-menu-danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 aria-hidden="true" />
            Supprimer
          </button>

          {error && (
            <p className="admin-community__row-menu-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Largeurs figées (voir `tableClassName="admin-crud__table--fixed"` sur
// l'AdminCrud des membres) : sans elles, une colonne à contenu large
// (le nom, ou un long nom d'église/bergerie repris ailleurs) prenait
// toute la place au détriment des autres, qui se retrouvaient à
// repasser leur contenu à la ligne. Somme volontairement < 100 % :
// le reste revient à la colonne Actions (voir `__actions-col`). Pas de
// colonne « Carte » séparée : son téléchargement vit désormais dans le
// menu Actions (`MemberRowMenu`), avec Modifier et Supprimer — d'où la
// place regagnée, redistribuée à Membre/Quartier/Téléphone.
const memberColumns = [
  {
    key: "registrationNumber",
    label: "Matricule",
    width: "13%",
    render: (item) =>
      item.registrationNumber ? (
        <strong>{formatRegistrationNumber(item.registrationNumber)}</strong>
      ) : (
        "—"
      ),
  },
  {
    key: "name",
    label: "Membre",
    width: "27%",
    render: (item) => {
      const parts = [
        item.firstName ? toTitleCase(item.firstName) : "",
        item.lastName ? item.lastName.toUpperCase() : "",
      ].filter(Boolean);

      return parts.join(" ") || "—";
    },
  },
  { key: "area", label: "Quartier / groupe", width: "20%" },
  {
    key: "role",
    label: "Rôle",
    width: "10%",
    render: (item) => (
      <span className="admin-crud__pill">
        {ROLE_LABELS[item.role] ?? "—"}
      </span>
    ),
  },
  { key: "phone", label: "Téléphone", width: "17%" },
  {
    key: "status",
    label: "Statut",
    width: "9%",
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

// `filters`/`onFiltersChange` sont possédés par l'écran parent
// (CommunityAdmin) plutôt que par ce composant : le tableau des
// membres (`AdminCrud`, via `listParams`) doit filtrer sur les mêmes
// église/bergerie que ce qui sera exporté, sinon l'export téléchargé
// pourrait surprendre en ne correspondant pas à ce qui est affiché.
const MemberExportButtons = ({
  flockOptions,
  churchOptions,
  filters,
  onFiltersChange,
}) => {
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
          onFiltersChange((previous) => ({
            ...previous,
            church: event.target.value,
          }))
        }
      >
        <option value="">Toutes les églises</option>
        {churchOptions.map((church) => (
          <option key={church.value} value={church.value}>
            {church.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrer par bergerie"
        value={filters.flock}
        onChange={(event) =>
          onFiltersChange((previous) => ({
            ...previous,
            flock: event.target.value,
          }))
        }
      >
        <option value="">Toutes les bergeries</option>
        {flockOptions.map((flock) => (
          <option key={flock.value} value={flock.value}>
            {flock.label}
          </option>
        ))}
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

      <p className="admin-community__export-hint">
        Les membres désactivés n&apos;apparaissent jamais dans ces exports.
      </p>
    </div>
  );
};

const TABS = [
  { id: "announcements", label: "Annonces" },
  {
    id: "members",
    label: "Membres",
    badgeKey: "membersTotal",
    // Compteur informatif : reste affiché en permanence (y compris à
    // 0), contrairement au badge « Inscriptions » qui signale une
    // action à traiter et disparaît une fois la file vidée.
    badgeAlwaysVisible: true,
    badgeAriaLabel: (n) => `${n} membre${n > 1 ? "s" : ""} enregistré${n > 1 ? "s" : ""}`,
  },
  { id: "flocks", label: "Bergeries" },
  { id: "churches", label: "Églises" },
  {
    id: "submissions",
    label: "Inscriptions",
    badgeKey: "pendingSubmissions",
    badgeAriaLabel: (n) => `${n} demande${n > 1 ? "s" : ""} en attente`,
  },
];

const CHURCH_STATUSES = [
  { value: "published", label: "Active" },
  { value: "draft", label: "Brouillon" },
  { value: "archived", label: "Archivée" },
];

const churchFields = [
  {
    name: "number",
    label: "Numéro",
    type: "number",
    required: true,
    help: "Fait partie du format du matricule des membres (ex. 1OL16005E). Le changer après coup désynchronise les matricules déjà attribués à cette église : à ne modifier qu'en toute connaissance de cause.",
  },
  { name: "name", label: "Nom de l'église", required: true },
  {
    name: "status",
    label: "Statut",
    type: "select",
    options: CHURCH_STATUSES,
  },
];

const CHURCH_STATUS_LABELS = Object.fromEntries(
  CHURCH_STATUSES.map((item) => [item.value, item.label])
);

const churchColumns = [
  { key: "number", label: "Numéro" },
  { key: "name", label: "Nom" },
  {
    key: "status",
    label: "Statut",
    render: (item) => CHURCH_STATUS_LABELS[item.status] ?? item.status,
  },
];

const churchToValues = (item) => ({
  number: item?.number ?? "",
  name: item?.name ?? "",
  status: item?.status ?? "published",
});

const churchToPayload = (values) => ({
  number: Number(values.number),
  name: values.name.trim(),
  status: values.status || "published",
});

const CommunityAdmin = () => {
  usePageMeta({
    title: "Communauté — Administration",
    description:
      "Gestion des membres et des annonces de la communauté CAVA.",
  });

  const [tab, setTab] = useState("announcements");

  // Église/bergerie : un seul état, partagé entre le tableau (via
  // `listParams`) et les boutons d'export — ce qui se télécharge
  // correspond toujours à ce qui est affiché à l'écran.
  const [memberFilters, setMemberFilters] = useState({ church: "", flock: "" });

  const pendingSubmissionsCount = usePendingSubmissionsCount();
  // Ne compte que les membres ACTIFS : un membre désactivé n'est plus
  // considéré comme faisant partie de l'effectif courant, cohérent
  // avec son exclusion des exports et son grisage dans la liste.
  const [membersCount, refreshMembersCount] = useMembersCount({
    status: "actif",
  });
  const tabBadgeValues = {
    pendingSubmissions: pendingSubmissionsCount,
    membersTotal: membersCount,
  };

  const { data: flockList } = useAsyncData(flocksApi.listAdmin);
  const { data: churchList } = useAsyncData(churchesApi.listAdmin);

  // Options « brutes » (valeur numérique) pour la résolution d'un
  // libellé, et variante en chaîne pour peupler les `<select>` des
  // formulaires — même distinction que pour `flockOptions` ci-dessous.
  const churchOptions = (churchList ?? []).map((church) => ({
    value: church.number,
    label: church.name,
  }));

  const churchSelectOptions = churchOptions.map((church) => ({
    value: String(church.value),
    label: church.label,
  }));

  const flockOptions = (flockList ?? []).map((flock) => ({
    value: flock.id,
    label: `${flock.name} (${churchLabelFrom(churchOptions, flock.church)})`,
  }));

  const memberFields = buildMemberFields(flockOptions, churchSelectOptions);
  const flockFields = buildFlockFields(churchSelectOptions);
  const flockColumns = buildFlockColumns(churchOptions);

  return (
    <div className="admin-community">
      <div
        className="admin-community__tabs"
        role="tablist"
        aria-label="Sections de la communauté"
      >
        {TABS.map((item) => {
          const badgeValue = item.badgeKey
            ? tabBadgeValues[item.badgeKey]
            : undefined;

          const showBadge = item.badgeAlwaysVisible
            ? badgeValue !== null && badgeValue !== undefined
            : Number(badgeValue) > 0;

          return (
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

              {showBadge && (
                <span
                  className={
                    item.badgeAlwaysVisible
                      ? "admin-community__tab-badge admin-community__tab-badge--info"
                      : "admin-community__tab-badge"
                  }
                  aria-label={item.badgeAriaLabel?.(badgeValue)}
                >
                  {badgeValue > 99 ? "99+" : badgeValue}
                </span>
              )}
            </button>
          );
        })}
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
            <MemberExportButtons
              flockOptions={flockOptions}
              churchOptions={churchSelectOptions}
              filters={memberFilters}
              onFiltersChange={setMemberFilters}
            />

            <AdminCrud
              resource={members}
              fields={memberFields}
              columns={memberColumns}
              tableClassName="admin-crud__table--fixed"
              searchable
              searchPlaceholder="Rechercher par nom ou matricule…"
              listParams={{
                church: memberFilters.church || undefined,
                flock: memberFilters.flock || undefined,
              }}
              rowClassName={(item) =>
                item.status === "inactif" ? "admin-crud__row--inactive" : ""
              }
              rowActions={(item, { onEdit, onDelete, reload }) => (
                <MemberRowMenu
                  member={item}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  reload={reload}
                  onStatusChanged={refreshMembersCount}
                />
              )}
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
        id="admin-community-panel-churches"
        aria-labelledby="admin-community-tab-churches"
        hidden={tab !== "churches"}
      >
        {tab === "churches" && (
          <AdminCrud
            resource={churchesApi}
            fields={churchFields}
            columns={churchColumns}
            labels={{
              singular: "une église",
              plural: "Églises",
              add: "Ajouter une église",
              empty:
                "Aucune église enregistrée. Elles alimentent la liste déroulante du tunnel d'inscription et de la fiche membre.",
              loadingSuffix: "des églises",
              description:
                "Une seule église existe aujourd'hui ; les numéros 2 à 5 sont réservés à de futures ouvertures.",
              titleKey: "name",
            }}
            toValues={churchToValues}
            toPayload={churchToPayload}
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
