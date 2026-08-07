// src/context/contributionReducer.test.js
import { describe, it, expect } from "vitest";

import { contributionReducer, initialState } from "./contributionReducer";

describe("contributionReducer", () => {
  it("met à jour le montant en le convertissant en nombre", () => {
    const state = contributionReducer(initialState, {
      type: "SET_AMOUNT",
      payload: "15000",
    });

    expect(state.amount).toBe(15000);
  });

  it("enregistre le type de don choisi (id + nom)", () => {
    const state = contributionReducer(initialState, {
      type: "SET_DONATION_TYPE",
      payload: { id: "abc", name: "Dîme" },
    });

    expect(state.donationType).toEqual({ id: "abc", name: "Dîme" });
  });

  it("enregistre le moyen de paiement choisi (id + nom + QR + numéro)", () => {
    const state = contributionReducer(initialState, {
      type: "SET_PAYMENT_METHOD",
      payload: {
        id: "xyz",
        name: "Orange Money",
        image: "https://x/y.png",
        accountNumber: "07 00 00 00 00",
        holderName: "CAVA",
      },
    });

    expect(state.paymentMethod).toEqual({
      id: "xyz",
      name: "Orange Money",
      image: "https://x/y.png",
      accountNumber: "07 00 00 00 00",
      holderName: "CAVA",
    });
  });

  it("fusionne les champs du donateur sans écraser les autres", () => {
    let state = contributionReducer(initialState, {
      type: "UPDATE_DONOR",
      payload: { firstName: "Awa" },
    });

    state = contributionReducer(state, {
      type: "UPDATE_DONOR",
      payload: { phone: "0700000000" },
    });

    expect(state.donor.firstName).toBe("Awa");
    expect(state.donor.phone).toBe("0700000000");
  });

  it("enregistre le numéro de transaction et l'image de preuve séparément", () => {
    let state = contributionReducer(initialState, {
      type: "SET_TRANSACTION_ID",
      payload: "MP240101.1234.A1",
    });

    state = contributionReducer(state, {
      type: "SET_PROOF_IMAGE",
      payload: "https://res.cloudinary.com/x/y.png",
    });

    expect(state.proof).toEqual({
      transactionId: "MP240101.1234.A1",
      imageUrl: "https://res.cloudinary.com/x/y.png",
    });
  });

  it("RESET revient à l'état initial", () => {
    const changed = contributionReducer(initialState, {
      type: "SET_AMOUNT",
      payload: 99999,
    });

    expect(contributionReducer(changed, { type: "RESET" })).toEqual(
      initialState
    );
  });
});
