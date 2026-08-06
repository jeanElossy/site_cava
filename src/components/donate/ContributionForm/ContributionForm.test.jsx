import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { ContributionProvider } from "../../../context/ContributionContext";
import ContributionForm from "./index";

vi.mock("../../../services/donations", () => ({
  fetchDonationTypes: vi.fn().mockResolvedValue([
    { id: "type-1", name: "Dîme" },
  ]),
  fetchPaymentMethods: vi.fn().mockResolvedValue([
    { id: "method-1", name: "Orange Money", image: { url: "" } },
  ]),
  submitDonation: vi.fn().mockResolvedValue({ reference: "CAVA-TEST1234", status: "en_attente" }),
}));

const renderForm = () =>
  render(
    <ContributionProvider>
      <ContributionForm />
    </ContributionProvider>
  );

describe("ContributionForm (orchestrateur)", () => {
  it("affiche la première étape (Vos informations) au départ", () => {
    renderForm();

    expect(
      screen.getByRole("list", { name: /étapes du don/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Prénom")).toBeInTheDocument();
  });

  it("bloque le passage à l'étape suivante quand un champ obligatoire manque", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /suivant/i }));

    expect(screen.getByText(/merci d'indiquer votre prénom/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Prénom")).toBeInTheDocument();
  });

  it("avance jusqu'à l'étape preuve une fois les champs remplis", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Awa" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Traoré" } });
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "0700000000" } });

    await waitFor(() =>
      expect(screen.getByLabelText("Type de don")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText("Type de don"), { target: { value: "type-1" } });

    fireEvent.click(screen.getByRole("button", { name: /suivant/i }));

    // "Moyen de paiement" apparaît deux fois à l'écran (libellé de
    // l'étape dans l'indicateur ET titre du groupe de choix dans
    // `StepPaymentMethod`) : cibler le groupe par son rôle lève
    // l'ambiguïté et confirme que l'étape 2 (StepPaymentMethod) est
    // bien montée, pas seulement que l'indicateur d'étape a changé.
    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: /moyen de paiement/i })
      ).toBeInTheDocument()
    );
  });
});
