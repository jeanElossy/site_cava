import { createContext } from "react";

// Séparé de ContributionContext.jsx et useContribution.js : aucun des
// deux ne doit exporter autre chose qu'un composant, sous peine de
// désactiver le Fast Refresh de Vite sur tout le fichier (règle
// ESLint react-refresh/only-export-components).
export const ContributionContext = createContext();

export const initialState = {
  amount: 10000,

  // `{ id: "", name: "" }` tant que la liste n'a pas encore répondu
  // (voir StepIdentity) — un id vide bloque la validation de l'étape,
  // pas de valeur par défaut arbitraire comme dans l'ancien tunnel.
  donationType: { id: "", name: "" },

  // `image` est le QR Mobile Money officiel de l'église pour ce moyen.
  // `accountNumber` / `holderName` l'accompagnent sur le billet
  // d'offrande : le donateur qui a scanné le QR projeté pendant le
  // culte arrive sur /donate avec CE MÊME téléphone, et ne peut donc
  // pas en scanner un second à l'écran — il lui faut le numéro en
  // clair pour le composer à la main.
  paymentMethod: {
    id: "",
    name: "",
    image: "",
    accountNumber: "",
    holderName: "",
  },

  donor: {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  },

  proof: {
    transactionId: "",
    imageUrl: "",
  },
};

export function contributionReducer(state, action) {
  switch (action.type) {
    case "SET_AMOUNT":
      return {
        ...state,
        amount: Number(action.payload),
      };

    case "SET_DONATION_TYPE":
      return {
        ...state,
        donationType: action.payload,
      };

    case "SET_PAYMENT_METHOD":
      return {
        ...state,
        paymentMethod: action.payload,
      };

    case "UPDATE_DONOR":
      return {
        ...state,
        donor: {
          ...state.donor,
          ...action.payload,
        },
      };

    case "SET_TRANSACTION_ID":
      return {
        ...state,
        proof: {
          ...state.proof,
          transactionId: action.payload,
        },
      };

    case "SET_PROOF_IMAGE":
      return {
        ...state,
        proof: {
          ...state.proof,
          imageUrl: action.payload,
        },
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}
