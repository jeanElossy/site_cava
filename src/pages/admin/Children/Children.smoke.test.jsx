import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Test de fumée des écrans du module Enfants.
//
// ------------------------------------------------------------------
// CE QU'IL VÉRIFIE, ET CE QU'IL NE VÉRIFIE PAS
// ------------------------------------------------------------------
// Il monte chaque écran avec des données factices et vérifie qu'il
// atteint son titre sans lever. C'est faible, et c'est assumé : le
// module a été livré en production avec 412 tests au vert et aucune
// page fonctionnelle, parce que rien n'ouvrait d'écran.
//
// Il n'aurait PAS attrapé les deux pannes réelles — toutes deux
// venaient de l'ordre des routes, pas du rendu (voir
// `routeLinks.test.js`, qui couvre ce cas). Il attrape ce qui vient
// juste après : un import manquant, une propriété passée à un
// composant qui ne l'accepte pas, un plantage sur liste vide.
//
// Chaque écran est monté DEUX FOIS — avec des données, et avec des
// listes vides. Le second cas est celui d'une église qui démarre, et
// c'est précisément là qu'un `items[0]` non gardé casse.

const CLASSES = [
  { id: "c1", name: "03 à 05 ans", room: "Salle 1", childCount: 13, church: 1 },
];

const CHILDREN = [
  {
    id: "e1",
    fileNumber: "CAVA-ENF-000001",
    firstName: "Awa",
    lastName: "Koné",
    currentClass: CLASSES[0],
    status: "actif",
    missingFields: [],
  },
];

const EMPTY_META = { page: 1, limit: 30, total: 0, pages: 1 };

// Un seul module de service pour tous les écrans : chaque fonction
// renvoie une forme plausible, et `withData` bascule entre « il y a des
// données » et « il n'y en a aucune ».
let withData = true;

const list = (items) => (withData ? items : []);

const listWithMeta = (items) =>
  withData
    ? { items, meta: { ...EMPTY_META, total: items.length } }
    : { items: [], meta: EMPTY_META };

vi.mock("../../../services/children", () => ({
  listChildren: vi.fn(() => Promise.resolve(listWithMeta(CHILDREN))),
  getChild: vi.fn(() => Promise.resolve(CHILDREN[0])),
  createChild: vi.fn(() => Promise.resolve(CHILDREN[0])),
  updateChild: vi.fn(() => Promise.resolve(CHILDREN[0])),
  setChildStatus: vi.fn(() => Promise.resolve(CHILDREN[0])),
  assignClass: vi.fn(() => Promise.resolve(CHILDREN[0])),
  childAttendance: vi.fn(() => Promise.resolve(listWithMeta([]))),
  listGuardians: vi.fn(() => Promise.resolve(listWithMeta([]))),
  getGuardian: vi.fn(() => Promise.resolve(null)),
  guardianChildren: vi.fn(() => Promise.resolve([])),
  createGuardian: vi.fn(() => Promise.resolve({ id: "g1" })),
  updateGuardian: vi.fn(() => Promise.resolve({ id: "g1" })),
  deleteGuardian: vi.fn(() => Promise.resolve(null)),
  linkGuardian: vi.fn(() => Promise.resolve(null)),
  unlinkGuardian: vi.fn(() => Promise.resolve(null)),
  listClasses: vi.fn(() => Promise.resolve(list(CLASSES))),
  getClass: vi.fn(() => Promise.resolve(CLASSES[0])),
  createClass: vi.fn(() => Promise.resolve(CLASSES[0])),
  updateClass: vi.fn(() => Promise.resolve(CLASSES[0])),
  archiveClass: vi.fn(() => Promise.resolve(CLASSES[0])),
  listMonitors: vi.fn(() => Promise.resolve(list([]))),
  assignMonitor: vi.fn(() => Promise.resolve(null)),
  searchAssignableMembers: vi.fn(() => Promise.resolve([])),
  updateMonitor: vi.fn(() => Promise.resolve(null)),
  withdrawMonitor: vi.fn(() => Promise.resolve(null)),
  createMonitorAccount: vi.fn(() => Promise.resolve(null)),
  resetMonitorPassword: vi.fn(() => Promise.resolve(null)),
  setMonitorAccountStatus: vi.fn(() => Promise.resolve(null)),
  revokeMonitorAccount: vi.fn(() => Promise.resolve(null)),
  listSubstitutions: vi.fn(() => Promise.resolve(list([]))),
  createSubstitution: vi.fn(() => Promise.resolve(null)),
  updateSubstitution: vi.fn(() => Promise.resolve(null)),
  cancelSubstitution: vi.fn(() => Promise.resolve(null)),
  listSessions: vi.fn(() => Promise.resolve(listWithMeta([]))),
  createSession: vi.fn(() => Promise.resolve(null)),
  sessionRollCall: vi.fn(() => Promise.resolve({ session: {}, children: [] })),
  sessionStats: vi.fn(() => Promise.resolve(null)),
  listDocuments: vi.fn(() => Promise.resolve({ documents: [], storage: null })),
  uploadDocument: vi.fn(() => Promise.resolve(null)),
  openDocument: vi.fn(() => Promise.resolve({ url: "" })),
  validateDocument: vi.fn(() => Promise.resolve(null)),
  deleteDocument: vi.fn(() => Promise.resolve(null)),
  childrenDashboard: vi.fn(() =>
    Promise.resolve({
      totals: { children: 0, classes: 0, monitors: 0 },
      byClass: [],
      todayAttendance: [],
    })
  ),
  childrenHistory: vi.fn(() => Promise.resolve(listWithMeta([]))),
}));

const { default: ChildrenDashboard } = await import("./ChildrenDashboard");
const { default: ChildrenList } = await import("./ChildrenList");
const { default: ClassesAdmin } = await import("./ClassesAdmin");
const { default: MonitorsAdmin } = await import("./MonitorsAdmin");
const { default: SubstitutionsAdmin } = await import("./SubstitutionsAdmin");
const { default: GuardiansAdmin } = await import("./GuardiansAdmin");
const { default: HistoryAdmin } = await import("./HistoryAdmin");
const { default: SessionsAdmin } = await import("./SessionsAdmin");
const { default: ChildForm } = await import("./ChildForm");
const { default: ChildProfile } = await import("./ChildProfile");

const SCREENS = [
  ["Tableau de bord", ChildrenDashboard, "/admin/enfants"],
  ["Liste des enfants", ChildrenList, "/admin/enfants/liste"],
  ["Classes", ClassesAdmin, "/admin/enfants/classes"],
  ["Moniteurs", MonitorsAdmin, "/admin/enfants/moniteurs"],
  ["Remplacements", SubstitutionsAdmin, "/admin/enfants/remplacements"],
  ["Responsables", GuardiansAdmin, "/admin/enfants/responsables"],
  ["Historique", HistoryAdmin, "/admin/enfants/historique"],
  ["Séances", SessionsAdmin, "/admin/enfants/seances"],
  ["Nouvel enfant", ChildForm, "/admin/enfants/nouveau"],
  ["Fiche enfant", ChildProfile, "/admin/enfants/e1"],
];

const mount = (Screen, route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/admin/enfants/:id"
          element={<Screen />}
        />

        <Route
          path="*"
          element={<Screen />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("écrans du module Enfants — test de fumée", () => {
  beforeEach(() => {
    withData = true;
  });

  for (const [name, Screen, route] of SCREENS) {
    it(`${name} se monte et affiche son titre`, async () => {
      mount(Screen, route);

      // Le titre est rendu par `ChildrenPage`, donc sa présence
      // signifie que le composant est allé jusqu'au bout de son rendu.
      await waitFor(() => {
        expect(
          screen.getAllByRole("heading", { level: 1 }).length
        ).toBeGreaterThan(0);
      });
    });

    it(`${name} se monte sans aucune donnée`, async () => {
      withData = false;

      mount(Screen, route);

      await waitFor(() => {
        expect(
          screen.getAllByRole("heading", { level: 1 }).length
        ).toBeGreaterThan(0);
      });
    });
  }
});
