import {
  AlertTriangle,
  Baby,
  Banknote,
  Briefcase,
  Calendar,
  CalendarCheck,
  Church,
  GraduationCap,
  HandCoins,
  HandHelping,
  Heart,
  HeartHandshake,
  History,
  Image,
  LayoutDashboard,
  Mail,
  MessageSquareQuote,
  PiggyBank,
  Repeat,
  ScanLine,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Tag,
  Tent,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

import {
  AGENT_ROLES,
  CHILDREN_ROLES,
  FLOCK_PORTAL_ROLES,
  SOCIAL_ROLES,
  STAFF_ROLES,
} from "../../routes/roleGroups";

// Navigation de l'administration, partagée par la barre latérale, le
// fil d'Ariane de l'en-tête et la recherche rapide (Ctrl+K) : une seule
// liste, pour que les trois ne divergent jamais.
//
// `roles` (facultatif) restreint un groupe ou une entrée à certains
// rôles — même liste que la garde de route correspondante dans
// AdminRoutes.jsx. Sans `roles`, l'entrée reste visible à tout compte
// authentifié. Ce filtrage est du CONFORT : c'est l'API qui refuse.
//
// `keywords` alimente uniquement la recherche rapide : des mots qu'un
// utilisateur taperait sans connaître le libellé exact.
export const NAV_GROUPS = [
  {
    title: null,
    items: [
      {
        to: "/admin",
        label: "Tableau de bord",
        icon: LayoutDashboard,
        end: true,
        keywords: "accueil aperçu",
      },
      {
        to: "/admin/messages",
        label: "Messages",
        icon: Mail,
        roles: STAFF_ROLES,
        keywords: "contact boîte réception candidatures",
      },
      {
        to: "/admin/dons",
        label: "Dons",
        icon: HandCoins,
        roles: STAFF_ROLES,
        end: true,
        keywords: "contributions mobile money reçus",
      },
      {
        to: "/admin/dons/moyens-de-paiement",
        label: "Moyens de paiement",
        icon: Wallet,
        roles: ["admin"],
        keywords: "orange mtn moov wave qr",
      },
      {
        to: "/admin/dons/types",
        label: "Types de don",
        icon: Tag,
        roles: ["admin"],
        keywords: "dîme offrande",
      },
      {
        to: "/admin/newsletter",
        label: "Lettre d'information",
        icon: Send,
        roles: STAFF_ROLES,
        keywords: "newsletter abonnés e-mail",
      },
    ],
  },
  {
    title: "Contenu du site",
    roles: STAFF_ROLES,
    items: [
      { to: "/admin/medias", label: "Médias", icon: Image, keywords: "vidéos prédications louange" },
      { to: "/admin/evenements", label: "Événements", icon: Calendar, keywords: "agenda culte" },
      { to: "/admin/ministeres", label: "Ministères", icon: Church },
      { to: "/admin/postes", label: "Postes ouverts", icon: Briefcase, keywords: "candidatures recrutement" },
    ],
  },
  {
    // Groupe propre au responsable de bergerie : c'est sa seule entrée.
    title: "Ma bergerie",
    roles: FLOCK_PORTAL_ROLES,
    items: [{ to: "/admin/bergerie", label: "Mes membres", icon: Tent }],
  },
  {
    title: "Communauté",
    items: [
      {
        to: "/admin/communaute",
        label: "Membres et annonces",
        icon: Users,
        badgeKey: "pendingSubmissions",
        roles: STAFF_ROLES,
        keywords: "annuaire inscriptions bergeries églises matricule",
      },
      {
        to: "/admin/temoignages",
        label: "Témoignages",
        icon: MessageSquareQuote,
        roles: STAFF_ROLES,
      },
      {
        to: "/admin/presences",
        label: "Badgeage des présences",
        icon: ScanLine,
        roles: STAFF_ROLES,
        keywords: "qr scan pointage",
      },
      {
        // Réservé aux rôles acceptés par requireNewSoulActor côté API :
        // sans ce `roles`, les comptes du Service Social voyaient
        // l'entrée et tombaient sur un refus en cliquant dessus.
        to: "/admin/nouvelles-ames",
        label: "Nouvelles âmes",
        icon: Heart,
        badgeKey: "newSouls",
        roles: [...AGENT_ROLES, "admin"],
        keywords: "soa cana convertis suivi",
      },
    ],
  },
  {
    title: "Enfants",
    roles: CHILDREN_ROLES,
    items: [
      { to: "/admin/enfants", label: "Tableau de bord", icon: Baby, end: true, keywords: "école du dimanche" },
      { to: "/admin/enfants/liste", label: "Enfants", icon: Users },
      { to: "/admin/enfants/seances", label: "Séances et appel", icon: CalendarCheck },
      { to: "/admin/enfants/responsables", label: "Parents / Responsables", icon: HeartHandshake },
      { to: "/admin/enfants/classes", label: "Classes", icon: GraduationCap },
      { to: "/admin/enfants/moniteurs", label: "Moniteurs", icon: UserCog },
      { to: "/admin/enfants/remplacements", label: "Remplacements", icon: Repeat },
      { to: "/admin/enfants/historique", label: "Historique", icon: History },
    ],
  },
  {
    title: "Service Social",
    roles: SOCIAL_ROLES,
    items: [
      { to: "/admin/social", label: "Aperçu", icon: HeartHandshake, end: true },
      { to: "/admin/social/cotisations", label: "Offrandes", icon: Banknote, keywords: "cotisations" },
      { to: "/admin/social/arrieres", label: "Arriérés", icon: AlertTriangle, keywords: "impayés retard" },
      { to: "/admin/social/membres", label: "Membres", icon: Search, keywords: "fiche sociale" },
      { to: "/admin/social/caisse", label: "Caisse", icon: PiggyBank, keywords: "exercice solde" },
      { to: "/admin/social/aides", label: "Aides sociales", icon: HandHelping, end: true },
      {
        to: "/admin/social/aides/types",
        label: "Types d'aide",
        icon: Tag,
        roles: ["admin", "social_admin"],
      },
    ],
  },
  {
    title: "Configuration",
    roles: STAFF_ROLES,
    items: [
      { to: "/admin/parametres", label: "Paramètres", icon: Settings, keywords: "coordonnées horaires réseaux" },
      {
        // Réservé à l'admin, même parmi les rôles « staff » (voir
        // agent.service.js) : `roles` propre, plus strict que le groupe.
        to: "/admin/agents",
        label: "Agents",
        icon: ShieldCheck,
        roles: ["admin"],
        keywords: "comptes accès mot de passe",
      },
    ],
  },
];

// Libellés lisibles des rôles, pour le menu du compte.
export const ROLE_LABELS = {
  admin: "Administrateur",
  editor: "Éditeur",
  soa: "SOA",
  cana: "CANA",
  coordinateur_bergeries: "Coordonnateur des bergeries",
  responsable_bergerie: "Responsable de bergerie",
  pasteur: "Pasteur",
  social_admin: "Service Social — Responsable",
  social_agent: "Service Social — Agent",
  social_approver: "Service Social — Validateur",
  social_viewer: "Service Social — Lecture seule",
  responsable_ecole_dimanche: "Responsable École du dimanche",
  moniteur: "Moniteur",
};

/**
 * Groupes et entrées visibles pour un rôle. Un groupe dont toutes les
 * entrées sont filtrées disparaît, titre compris.
 */
export const visibleNavGroups = (role, groups = NAV_GROUPS) =>
  groups
    .filter((group) => !group.roles || group.roles.includes(role))
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || item.roles.includes(role)
      ),
    }))
    .filter((group) => group.items.length > 0);

/**
 * Entrée de navigation correspondant à une URL, avec son groupe : la
 * correspondance la plus LONGUE l'emporte, sans quoi « /admin/dons/types »
 * serait rattaché à « Dons ». Une fiche (« /admin/enfants/64f… ») se
 * rattache à sa liste parente.
 *
 * Renvoie `null` quand rien ne correspond.
 */
export const findActiveEntry = (pathname, groups) => {
  const path = String(pathname ?? "").replace(/\/+$/, "") || "/";

  let best = null;

  for (const group of groups) {
    for (const item of group.items) {
      const exact = path === item.to;
      const nested = path.startsWith(`${item.to}/`);

      // Le tableau de bord (« /admin ») ne sert de parent à personne :
      // toute page de l'admin commence par « /admin/ ».
      const matches = exact || (nested && item.to !== "/admin");

      if (matches && (!best || item.to.length > best.item.to.length)) {
        best = { group, item, exact };
      }
    }
  }

  return best;
};

/**
 * Filtre de la recherche rapide : insensible à la casse et aux accents,
 * sur le libellé, le titre du groupe et les mots-clés. Chaque mot saisi
 * doit être trouvé quelque part.
 */
const fold = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const searchNav = (query, groups) => {
  const words = fold(query).split(/\s+/).filter(Boolean);

  const entries = groups.flatMap((group) =>
    group.items.map((item) => ({ group, item }))
  );

  if (words.length === 0) return entries;

  return entries.filter(({ group, item }) => {
    const haystack = fold(
      `${item.label} ${group.title ?? ""} ${item.keywords ?? ""}`
    );

    return words.every((word) => haystack.includes(word));
  });
};
