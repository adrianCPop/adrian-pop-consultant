/**
 * The voyage pages in two languages: which one a visitor gets, the texts, and
 * the figures, dates and directions written the way each language writes them.
 * No React here; the pages reach this through `useVoyageTexts`.
 */
import { compassPoint, formatCoord, type LatLon } from "@/lib/geo";
import { MESSAGES, SERVER_TEXT_RO, type MessageKey } from "@/lib/voyageMessages";

export type VoyageLanguage = "EN" | "RO";

export const LANGUAGES: VoyageLanguage[] = ["EN", "RO"];

/**
 * Where a visitor's choice is kept on their device. Not the key "language": the
 * site's older switch wrote "EN" there for every visitor without being asked, so
 * finding it says nothing about what the visitor wants.
 */
export const LANGUAGE_STORE = "voyage-language";

/** What each language calls itself. */
export const LANGUAGE_NAMES: Record<VoyageLanguage, string> = { EN: "English", RO: "Română" };

const HTML_LANG: Record<VoyageLanguage, string> = { EN: "en", RO: "ro" };
const DATE_LOCALE: Record<VoyageLanguage, string> = { EN: "en-GB", RO: "ro-RO" };
const NUMBER_LOCALE: Record<VoyageLanguage, string> = { EN: "en-US", RO: "ro-RO" };

/**
 * The language for this visitor: the one they chose earlier, else the first of
 * their browser's languages that the page has, else English.
 */
export const pickLanguage = (
  saved: string | null | undefined,
  preferred: readonly string[]
): VoyageLanguage => {
  if (saved === "EN" || saved === "RO") {
    return saved;
  }
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "ro") {
      return "RO";
    }
    if (base === "en") {
      return "EN";
    }
  }
  return "EN";
};

export type Params = Record<string, string | number>;

/**
 * Which form of a message a whole number takes. Romanian: 1; then 0 and
 * everything ending in 01 to 19 ("2 zile", "101 zile"); then the rest, which
 * takes "de" ("20 de zile").
 */
const pluralForm = (language: VoyageLanguage, count: number): "one" | "few" | "other" => {
  if (count === 1) {
    return "one";
  }
  if (language === "RO") {
    const lastTwo = Math.abs(count) % 100;
    return count === 0 || (lastTwo >= 1 && lastTwo <= 19) ? "few" : "other";
  }
  return "other";
};

const template = (language: VoyageLanguage, key: MessageKey, params: Params): string => {
  const message = MESSAGES[language][key];
  if (typeof message === "string") {
    return message;
  }
  return message[pluralForm(language, Number(params.count))] ?? message.other;
};

export const translate = (language: VoyageLanguage, key: MessageKey, params: Params = {}): string =>
  template(language, key, params).replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole
  );

export type MessagePart = string | { slot: string };

/**
 * A message cut at the placeholders the page draws itself (a link, a figure in
 * bold). Placeholders that `params` has a value for are filled in as text.
 */
const messageParts = (language: VoyageLanguage, key: MessageKey, params: Params): MessagePart[] => {
  const parts: MessagePart[] = [];
  const addText = (text: string) => {
    const last = parts[parts.length - 1];
    if (typeof last === "string") {
      parts[parts.length - 1] = last + text;
    } else if (text !== "") {
      parts.push(text);
    }
  };
  for (const piece of template(language, key, params).split(/(\{\w+\})/)) {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    if (name === undefined) {
      addText(piece);
    } else if (name in params) {
      addText(String(params[name]));
    } else {
      parts.push({ slot: name });
    }
  }
  return parts;
};

/** What the server said, in the page's language. Unknown sentences pass through. */
export const serverText = (language: VoyageLanguage, message: string): string => {
  if (language === "EN") {
    return message;
  }
  // Looked up as its own entry only: "constructor" is not a sentence of the server's.
  if (Object.prototype.hasOwnProperty.call(SERVER_TEXT_RO, message)) {
    return SERVER_TEXT_RO[message];
  }
  // Written by the page itself, in `voyageApi.ts`, when the server gave no sentence.
  const status = /^The server answered (\d+)$/.exec(message);
  return status ? translate(language, "server.answered", { status: status[1] }) : message;
};

/**
 * The note the outbox keeps with an entry that did not go. It is stored on the
 * device in English, as `voyageOutbox.ts` wrote it, and put into words here.
 */
export const outboxErrorText = (language: VoyageLanguage, stored: string): string => {
  if (language === "EN") {
    return stored;
  }
  if (stored === MESSAGES.EN["outbox.onePhoto"]) {
    return translate(language, "outbox.onePhoto");
  }
  const refused = /^Not accepted: (.+)$/.exec(stored);
  if (refused) {
    return translate(language, "outbox.notAccepted", { reason: serverText(language, refused[1]) });
  }
  const retried = /^Server: (.+)\. It will be tried again\.$/.exec(stored);
  if (retried) {
    return translate(language, "outbox.retry", { message: serverText(language, retried[1]) });
  }
  return serverText(language, stored);
};

/** Everything a page needs to speak one language. */
export const makeTexts = (language: VoyageLanguage) => {
  const t = (key: MessageKey, params?: Params) => translate(language, key, params);

  const number = (value: number, decimals = 0) => {
    // Rounded first, so that a figure just under zero reads "0" and not "-0".
    const rounded = decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));
    return new Intl.NumberFormat(NUMBER_LOCALE[language], {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(rounded === 0 ? 0 : rounded);
  };

  const date = (time: number | string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(DATE_LOCALE[language], options).format(new Date(time));
  const utc = (time: number | string, options: Intl.DateTimeFormatOptions) =>
    date(time, { timeZone: "UTC", ...options });

  /** A compass point as this language writes it: Romanian has V (vest) for W. */
  const point = (english: string) =>
    language === "RO" && typeof english === "string" ? english.replace(/W/g, "V") : english;

  return {
    language,
    /** For the `lang` attribute of whatever holds the page's text. */
    htmlLang: HTML_LANG[language],
    t,
    parts: (key: MessageKey, params: Params = {}) => messageParts(language, key, params),
    number,
    miles: (value: number) => t("unit.miles", { value: number(value) }),
    knots: (value: number) => t("unit.knots", { value: number(value, 1) }),
    point,
    compass: (deg: number) => point(compassPoint(deg)),
    coord: (pos: LatLon) =>
      formatCoord(pos, language === "RO" ? { west: "V" } : undefined),

    // Times at sea are given in UTC.
    dayMonth: (time: number | string) => utc(time, { day: "numeric", month: "short" }),
    fullDate: (time: number | string) =>
      utc(time, { day: "numeric", month: "long", year: "numeric" }),
    clock: (time: number | string) =>
      t("common.utcTime", { time: utc(time, { hour: "2-digit", minute: "2-digit" }) }),
    /** Weekday, day, month and time in UTC: "Tue 17 Nov, 12:00 UTC". */
    dayTime: (time: number | string) =>
      t("common.utcTime", {
        time: `${utc(time, { weekday: "short", day: "numeric", month: "short" })}, ${utc(time, {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      }),
    /** Day, month and time in UTC, as the shore controls list things. */
    stamp: (time: number | string) =>
      t("common.utcTime", {
        time: utc(time, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      }),
    /** Day, month and time by the device's own clock, as the crew's outbox lists things. */
    localStamp: (time: number | string) =>
      date(time, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),

    /** A stretch of time: "45 min", "3 h 20 min", "5 days". */
    span: (ms: number) => {
      const minutes = Math.max(0, Math.round(ms / 60_000));
      if (minutes < 60) {
        return t("span.minutes", { minutes });
      }
      const hours = Math.floor(minutes / 60);
      if (hours < 48) {
        const rest = minutes % 60;
        return rest === 0 ? t("span.hours", { hours }) : t("span.hoursMinutes", { hours, minutes: rest });
      }
      return t("span.days", { count: Math.floor(hours / 24) });
    },
    /** Time at sea, in days and hours, for a tight spot: "9 d 2 h". */
    duration: (hours: number) => {
      const days = Math.floor(hours / 24);
      const rest = Math.floor(hours - days * 24);
      return rest === 0 ? t("duration.days", { days }) : t("duration.daysHours", { days, hours: rest });
    },
    /** The same where there is room. English keeps "9 d 2 h"; Romanian spells it out. */
    durationLong: (hours: number) => {
      const days = Math.floor(hours / 24);
      const rest = Math.floor(hours - days * 24);
      const daysText = t("durationLong.days", { count: days });
      const hoursText = t("durationLong.hours", { count: rest });
      if (days === 0) {
        return hoursText;
      }
      return rest === 0 ? daysText : t("durationLong.both", { days: daysText, hours: hoursText });
    },

    /**
     * A text the shore contact typed (a port's name, the small heading): its
     * Romanian version on the Romanian page, when one was given.
     */
    own: (text: string, romanian: string | null | undefined) =>
      language === "RO" && romanian && romanian.trim() ? romanian : text,

    server: (message: string) => serverText(language, message),
    outboxError: (stored: string) => outboxErrorText(language, stored),
  };
};

export type VoyageTexts = ReturnType<typeof makeTexts>;
