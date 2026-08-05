import { useContext } from "react";

import { ContributionContext } from "./contributionReducer";

export const useContribution = () => useContext(ContributionContext);
