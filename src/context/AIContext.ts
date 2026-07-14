import { createContext, useContext } from 'react';

export interface AIContextType {
  currentContext: string;
  activePatientId: string | null;
  isFocusMode: boolean;
  toggleFocusMode: () => void;
  contextSummary: string;
}

export const AIContext = createContext<AIContextType | undefined>(undefined);

export const useAI = () => {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};
