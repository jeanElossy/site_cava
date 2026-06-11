import {
  createContext,
  useContext,
  useReducer,
} from "react";

const ContributionContext = createContext();

const initialState = {
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

function contributionReducer(state, action) {
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

export const ContributionProvider = ({
  children,
}) => {
  const [state, dispatch] = useReducer(
    contributionReducer,
    initialState
  );

  return (
    <ContributionContext.Provider
      value={{
        state,
        dispatch,
      }}
    >
      {children}
    </ContributionContext.Provider>
  );
};

export const useContribution = () =>
  useContext(ContributionContext);