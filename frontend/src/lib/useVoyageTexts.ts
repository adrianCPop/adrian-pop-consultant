import { createElement, Fragment, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  LANGUAGE_STORE,
  makeTexts,
  pickLanguage,
  type Params,
  type VoyageLanguage,
} from "@/lib/voyageI18n";
import type { MessageKey } from "@/lib/voyageMessages";

/**
 * The language of the voyage pages, shared by everything on the page without a
 * provider around it. It starts from the visitor's earlier choice or their
 * browser, and is only written down when they pick one themselves.
 */
const listeners = new Set<() => void>();
let current: VoyageLanguage | null = null;

const savedChoice = () => {
  try {
    return window.localStorage.getItem(LANGUAGE_STORE);
  } catch {
    // Storage can be blocked (private windows); the browser's language decides then.
    return null;
  }
};

const currentLanguage = (): VoyageLanguage => {
  if (current === null) {
    const preferred = navigator.languages?.length
      ? navigator.languages
      : [navigator.language ?? ""];
    current = pickLanguage(savedChoice(), preferred);
  }
  return current;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setVoyageLanguage = (language: VoyageLanguage) => {
  current = language;
  try {
    window.localStorage.setItem(LANGUAGE_STORE, language);
  } catch {
    // Not remembered for the next visit; it still holds for this one.
  }
  listeners.forEach((listener) => listener());
};

/** The texts and formats of the language the page is in, and the way to change it. */
export const useVoyageTexts = () => {
  const language = useSyncExternalStore(subscribe, currentLanguage);

  return useMemo(() => {
    const texts = makeTexts(language);
    /** A sentence with a part the page draws itself: `slots` gives that part by its placeholder's name. */
    const rich = (key: MessageKey, slots: Record<string, ReactNode>, params?: Params): ReactNode =>
      texts
        .parts(key, params)
        .map((part, index) =>
          createElement(Fragment, { key: index }, typeof part === "string" ? part : slots[part.slot])
        );

    return { ...texts, rich, setLanguage: setVoyageLanguage };
  }, [language]);
};
