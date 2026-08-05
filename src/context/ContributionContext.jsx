import { useReducer } from "react";

import {
  ContributionContext,
  contributionReducer,
  initialState,
} from "./contributionReducer";

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
