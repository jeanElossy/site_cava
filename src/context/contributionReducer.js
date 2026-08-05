import { createContext } from "react";

// Séparé de ContributionContext.jsx et useContribution.js : aucun des
// deux ne doit exporter autre chose qu'un composant (respectivement
// `ContributionProvider` et `useContribution`), sous peine de
// désactiver le Fast Refresh de Vite sur tout le fichier (règle ESLint
// react-refresh/only-export-components).
export const ContributionContext = createContext();

export const initialState = {
  contributionType: "don",

  recurring: false,

  amount: 10000,

  project: "general",

  paymentMethod: "orange",

  donor: {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    anonymous: false,
  },
};

export function contributionReducer(state, action) {
  switch (action.type) {
    case "SET_TYPE":
      return {
        ...state,
        contributionType: action.payload,
      };

    case "SET_RECURRING":
      return {
        ...state,
        recurring: action.payload,
      };

    case "SET_AMOUNT":
      return {
        ...state,
        amount: Number(action.payload),
      };

    case "SET_PROJECT":
      return {
        ...state,
        project: action.payload,
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

    case "RESET":
      return initialState;

    default:
      return state;
  }
}
