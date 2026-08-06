import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { ContributionProvider } from "../../../context/ContributionContext";
import ContributionForm from "./index";
import { submitDonation } from "../../../services/donations";

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

  it("affiche l'échec d'envoi près du bouton Envoyer, et l'efface au retour vers l'étape précédente", async () => {
    submitDonation.mockRejectedValueOnce(
      new Error("Le service est momentanément indisponible.")
    );

    renderForm();

    // Étape 0 : informations, type, montant (le montant par défaut de
    // l'état initial est valide, inutile de le renseigner).
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Awa" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Traoré" } });
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "0700000000" } });

    await waitFor(() =>
      expect(screen.getByLabelText("Type de don")).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText("Type de don"), { target: { value: "type-1" } });

    fireEvent.click(screen.getByRole("button", { name: /suivant/i }));

    // Étape 1 : moyen de paiement.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /orange money/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /orange money/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant/i }));

    // Étape 2 : billet QR — on avance via le bouton de SummaryCard,
    // pas via un "Suivant" (masqué à cette étape).
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /j'ai effectué le paiement/i })
      ).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /j'ai effectué le paiement/i }));

    // Étape 3 : preuve — numéro de transaction obligatoire puis envoi.
    await waitFor(() =>
      expect(screen.getByLabelText(/numéro de transaction mobile money/i)).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText(/numéro de transaction mobile money/i), {
      target: { value: "TXN123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    // L'échec de `submitDonation` doit être visible pour le donateur,
    // près du bouton "Envoyer" — pas seulement journalisé en silence
    // (régression : SummaryCard n'affichait cette erreur qu'à l'étape 2,
    // où elle n'est jamais déclenchée).
    await waitFor(() =>
      expect(
        screen.getByText(/le service est momentanément indisponible/i)
      ).toBeInTheDocument()
    );

    // Pas de redirection vers l'écran de confirmation après un échec.
    expect(screen.queryByText(/merci pour votre don/i)).not.toBeInTheDocument();

    // Revenir à l'étape précédente (billet QR) ne doit pas laisser
    // traîner l'erreur d'envoi, sans rapport avec le bouton affiché à
    // cette étape (régression : `goBack` ne vidait pas `submitError`).
    fireEvent.click(screen.getByRole("button", { name: /retour/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /j'ai effectué le paiement/i })
      ).toBeInTheDocument()
    );

    expect(
      screen.queryByText(/le service est momentanément indisponible/i)
    ).not.toBeInTheDocument();
  });
});
