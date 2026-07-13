import type { NavigateFunction } from "react-router-dom";

export const clearSynapseNotesNavigationState = (
  navigate: NavigateFunction,
  pathname: string,
  search: string,
) => {
  navigate(`${pathname}${search}`, { replace: true, state: null });
};
