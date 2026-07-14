import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type AddressSuggestion = {
  id: string;
  label: string;
  source: "google" | "viacep" | "manual";
  metadata?: Record<string, unknown>;
};

export type ValidatedAddress = {
  label: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  placeId?: string;
  source?: "google" | "viacep" | "manual";
  validatedAt?: string;
  geometry?: unknown;
};

async function invokeAddressFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data as T;

  let message = error.message || "Não conseguimos consultar endereços agora.";
  const context = (error as { context?: Response }).context;
  if (context) {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === "string") message = payload.error;
    } catch {
      try {
        const text = await context.clone().text();
        if (text) message = text;
      } catch {
        // Keep fallback message.
      }
    }
  }
  throw new Error(message);
}

function manualAddressSuggestion(query: string): AddressSuggestion | null {
  const trimmed = query.trim();
  if (trimmed.length < 8 || !/\d/.test(trimmed)) return null;
  return {
    id: `manual:${trimmed}`,
    label: trimmed,
    source: "manual",
  };
}

export function useAddressAutocomplete(query: string, selectedLabel?: string) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || normalizedQuery === selectedLabel) {
      setSuggestions([]);
      setError(null);
      return;
    }

    if (normalizedQuery.length < 3) {
      setSuggestions([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      void invokeAddressFunction<{ suggestions: AddressSuggestion[]; message?: string }>(
        "address-autocomplete",
        { query: normalizedQuery },
      )
        .then((result) => {
          const remoteSuggestions = result.suggestions || [];
          const manualSuggestion = manualAddressSuggestion(normalizedQuery);
          setSuggestions(remoteSuggestions.length > 0 ? remoteSuggestions : manualSuggestion ? [manualSuggestion] : []);
          setError(remoteSuggestions.length > 0 ? null : result.message || null);
        })
        .catch((caught) => {
          const manualSuggestion = manualAddressSuggestion(normalizedQuery);
          setSuggestions(manualSuggestion ? [manualSuggestion] : []);
          setError(
            manualSuggestion
              ? "Validação automática indisponível. Você pode usar o endereço digitado."
              : caught instanceof Error
                ? caught.message
                : "Não conseguimos buscar endereços agora.",
          );
        })
        .finally(() => setIsLoading(false));
    }, 450);

    return () => {
      window.clearTimeout(timer);
      setIsLoading(false);
    };
  }, [query, selectedLabel]);

  const validateSuggestion = useCallback(async (suggestion: AddressSuggestion) => {
    setIsValidating(true);
    setError(null);
    try {
      if (suggestion.source === "manual") {
        const address: ValidatedAddress = {
          label: suggestion.label,
          source: "manual",
          validatedAt: new Date().toISOString(),
        };
        setSuggestions([]);
        return address;
      }

      const result = await invokeAddressFunction<{ valid: boolean; address: ValidatedAddress; error?: string }>(
        "address-validate",
        { suggestion },
      );

      if (!result.valid || !result.address?.label) {
        throw new Error(result.error || "Selecione um endereço válido.");
      }

      setSuggestions([]);
      return result.address;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => setSuggestions([]), []);

  return {
    suggestions,
    isLoading,
    isValidating,
    error,
    validateSuggestion,
    clearSuggestions,
  };
}
