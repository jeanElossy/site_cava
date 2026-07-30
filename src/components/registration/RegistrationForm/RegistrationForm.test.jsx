import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { RegistrationProvider } from "../../../context/RegistrationContext";
import RegistrationForm from "./index";

// `StepIdentity` (étape 1) interroge l'API des bergeries dès qu'une
// église est choisie. Ce test ne va jamais jusque-là : la simple
// présence du composant dans l'arbre suffit à déclencher l'appel côté
// `StepLookup` -> `StepIdentity` au changement d'étape, donc on le
// neutralise pour ne pas dépendre du réseau. L'orchestrateur charge
// aussi la liste des églises dès le montage (voir index.jsx) : il faut
// donc aussi neutraliser `churches.list`.
vi.mock("../../../services/api", () => ({
  flocks: { list: vi.fn().mockResolvedValue([]) },
  churches: { list: vi.fn().mockResolvedValue([]) },
  memberSubmissions: { submit: vi.fn().mockResolvedValue({ received: true }) },
}));

// `useSearchParams` (lecture de ?matricule= depuis le QR code de la
// carte de membre, voir index.jsx) exige un contexte de routage.
const renderForm = (initialEntries = ["/inscription"]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <RegistrationProvider>
        <RegistrationForm />
      </RegistrationProvider>
    </MemoryRouter>
  );

describe("RegistrationForm (orchestrateur)", () => {
  it("affiche la première étape (Matricule) au départ", () => {
    renderForm();

    expect(
      screen.getByRole("list", { name: /étapes de l'inscription/i })
    ).toBeInTheDocument();
    // "Votre situation" apparaît deux fois à l'écran (titre d'étape en
    // <h2> ET label du choix nouveau/déjà-inscrit) : cibler le titre
    // par son rôle lève l'ambiguïté.
    expect(
      screen.getByRole("heading", { name: "Votre situation" })
    ).toBeInTheDocument();
  });

  it("bloque le passage à l'étape suivante quand un champ obligatoire manque", async () => {
    renderForm();

    // Étape 0 -> 1 : "new" est le choix par défaut, aucune validation
    // ne bloque ce premier passage.
    fireEvent.click(screen.getByRole("button", { name: /suivant/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Prénom")).toBeInTheDocument();
    });

    // Étape 1 (Identité) : rien n'est rempli, le passage doit être
    // bloqué avec un message explicite, et le champ Prénom doit rester
    // affiché (pas d'avancée vers l'étape Contact).
    fireEvent.click(screen.getByRole("button", { name: /suivant/i }));

    expect(
      screen.getByText("Merci d'indiquer votre prénom.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Prénom")).toBeInTheDocument();
  });

  it("pré-remplit le matricule et bascule sur « j'ai déjà un matricule » depuis ?matricule= (lien du QR code)", () => {
    renderForm(["/inscription?matricule=1OL25045S"]);

    // Le champ « nom de famille » n'existe que pour kind === "update" :
    // sa présence prouve le basculement automatique.
    expect(
      screen.getByLabelText("Votre matricule")
    ).toHaveValue("1OL25045S");
    expect(
      screen.getByLabelText("Votre nom de famille")
    ).toBeInTheDocument();
  });
});
