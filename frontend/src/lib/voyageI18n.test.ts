import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  makeTexts,
  outboxErrorText,
  pickLanguage,
  serverText,
  translate,
  type VoyageLanguage,
} from "@/lib/voyageI18n";
import { MESSAGES, type Message, type MessageKey } from "@/lib/voyageMessages";

const keys = Object.keys(MESSAGES.EN) as MessageKey[];
const forms = (message: Message) =>
  typeof message === "string" ? [message] : Object.values(message);
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((hit) => hit[1]).sort();

describe("pickLanguage, which language a visitor gets", () => {
  it("keeps the language the visitor chose earlier, whatever the browser says", () => {
    expect(pickLanguage("RO", ["en-US"])).toBe("RO");
    expect(pickLanguage("EN", ["ro-RO", "ro"])).toBe("EN");
  });

  it("follows the browser on a first visit", () => {
    expect(pickLanguage(null, ["ro-RO", "en-US"])).toBe("RO");
    expect(pickLanguage(null, ["ro"])).toBe("RO");
    expect(pickLanguage(null, ["en-GB"])).toBe("EN");
  });

  it("takes the first of the browser's languages that the page has", () => {
    expect(pickLanguage(null, ["en-US", "ro"])).toBe("EN");
    expect(pickLanguage(null, ["de-DE", "ro-RO", "en"])).toBe("RO");
  });

  it("falls back to English", () => {
    expect(pickLanguage(null, ["fr-FR", "de"])).toBe("EN");
    expect(pickLanguage(null, [])).toBe("EN");
    expect(pickLanguage(undefined, ["robot"])).toBe("EN");
  });

  it("ignores a saved value it does not know", () => {
    expect(pickLanguage("FR", ["ro-RO"])).toBe("RO");
    expect(pickLanguage("", ["ro-RO"])).toBe("RO");
  });
});

describe("the two sets of texts", () => {
  it("have the same messages", () => {
    expect(Object.keys(MESSAGES.RO).sort()).toEqual([...keys].sort());
  });

  it("use the same placeholders in every form of a message", () => {
    const different = keys.filter((key) => {
      const expected = JSON.stringify(placeholders(forms(MESSAGES.EN[key])[0]));
      return [...forms(MESSAGES.EN[key]), ...forms(MESSAGES.RO[key])].some(
        (text) => JSON.stringify(placeholders(text)) !== expected
      );
    });
    expect(different).toEqual([]);
  });

  it("give Romanian its three forms wherever the wording depends on a number", () => {
    const incomplete = keys.filter((key) => {
      const english = MESSAGES.EN[key];
      const romanian = MESSAGES.RO[key];
      return (
        typeof english !== "string" &&
        (typeof romanian === "string" || !romanian.one || !romanian.few || !romanian.other)
      );
    });
    expect(incomplete).toEqual([]);
  });

  it("leave nothing in English by oversight", () => {
    // Texts that really are the same in both languages.
    const same = new Set<MessageKey>([
      "unit.metres",
      "unit.celsius",
      "span.minutes",
      "span.hours",
      "span.hoursMinutes",
      "common.utcTime",
      "public.weather.windFrom",
      "admin.tracker.kind",
    ]);
    const untranslated = keys.filter(
      (key) =>
        !same.has(key) && JSON.stringify(MESSAGES.EN[key]) === JSON.stringify(MESSAGES.RO[key])
    );
    expect(untranslated).toEqual([]);
  });

  it("have no empty text", () => {
    const empty = keys.filter((key) =>
      [...forms(MESSAGES.EN[key]), ...forms(MESSAGES.RO[key])].some((text) => text.trim() === "")
    );
    expect(empty).toEqual([]);
  });
});

describe("translate", () => {
  it("puts the values in", () => {
    expect(translate("EN", "public.entry.writtenBy", { author: "Ioana" })).toBe("Written by Ioana");
    expect(translate("RO", "public.entry.writtenBy", { author: "Ioana" })).toBe("Scris de Ioana");
  });

  it("does not read a value as a template", () => {
    expect(translate("EN", "public.entry.writtenBy", { author: "{count}" })).toBe(
      "Written by {count}"
    );
  });

  it("uses the two English forms", () => {
    expect(translate("EN", "common.photos", { count: 1 })).toBe("1 photo");
    expect(translate("EN", "common.photos", { count: 0 })).toBe("0 photos");
    expect(translate("EN", "common.photos", { count: 12 })).toBe("12 photos");
  });

  it("uses the three Romanian forms: 1, then 2 to 19, then 20 and up with 'de'", () => {
    const photos = (count: number) => translate("RO", "common.photos", { count });
    expect(photos(1)).toBe("1 fotografie");
    expect(photos(0)).toBe("0 fotografii");
    expect(photos(2)).toBe("2 fotografii");
    expect(photos(19)).toBe("19 fotografii");
    expect(photos(20)).toBe("20 de fotografii");
    expect(photos(100)).toBe("100 de fotografii");
    expect(photos(101)).toBe("101 fotografii");
    expect(photos(119)).toBe("119 fotografii");
    expect(photos(120)).toBe("120 de fotografii");
  });
});

describe("figures, dates and directions in each language", () => {
  const english = makeTexts("EN");
  const romanian = makeTexts("RO");
  const morning = Date.parse("2026-11-20T09:05:00Z");

  it("groups thousands the way each language does", () => {
    expect(english.number(3016.4)).toBe("3,016");
    expect(romanian.number(3016.4)).toBe("3.016");
  });

  it("writes one decimal with a point in English and a comma in Romanian", () => {
    expect(english.number(5.2, 1)).toBe("5.2");
    expect(romanian.number(5.2, 1)).toBe("5,2");
    expect(english.number(7, 1)).toBe("7.0");
  });

  it("puts the unit after the figure", () => {
    expect(english.miles(3016.4)).toBe("3,016 nm");
    expect(romanian.miles(3016.4)).toBe("3.016 Mm");
    expect(english.knots(5.24)).toBe("5.2 kn");
    expect(romanian.knots(5.24)).toBe("5,2 nd");
  });

  it("writes dates in the page's language, always in UTC", () => {
    expect(english.dayMonth(morning)).toBe("20 Nov");
    expect(romanian.dayMonth(morning)).toBe("20 nov.");
    expect(english.fullDate(morning)).toBe("20 November 2026");
    expect(romanian.fullDate(morning)).toBe("20 noiembrie 2026");
    expect(english.clock(morning)).toBe("09:05 UTC");
    expect(romanian.clock(morning)).toBe("09:05 UTC");
    // Close to midnight UTC the date must not slip to the device's own day.
    expect(romanian.dayMonth(Date.parse("2026-11-20T23:59:00Z"))).toBe("20 nov.");
  });

  it("names west V in Romanian, in compass points and in positions", () => {
    expect(english.compass(270)).toBe("W");
    expect(romanian.compass(270)).toBe("V");
    expect(romanian.compass(225)).toBe("SV");
    expect(romanian.compass(292.5)).toBe("VNV");
    expect(romanian.compass(90)).toBe("E");
    expect(romanian.point("NNW")).toBe("NNV");
    expect(english.point("NNW")).toBe("NNW");
    expect(english.coord([28.47, -16.25])).toBe("28°28′N 016°15′W");
    expect(romanian.coord([28.47, -16.25])).toBe("28°28′N 016°15′V");
    expect(romanian.coord([-12.5, 16.25])).toBe("12°30′S 016°15′E");
  });

  it("says how long ago or how far ahead", () => {
    expect(english.span(45 * 60_000)).toBe("45 min");
    expect(romanian.span(45 * 60_000)).toBe("45 min");
    expect(english.span(200 * 60_000)).toBe("3 h 20 min");
    expect(english.span(3 * 3_600_000)).toBe("3 h");
    expect(english.span(5 * 86_400_000)).toBe("5 days");
    expect(romanian.span(5 * 86_400_000)).toBe("5 zile");
    expect(romanian.span(20 * 86_400_000)).toBe("20 de zile");
    expect(english.span(-5)).toBe("0 min");
  });

  it("gives the time at sea in days and hours", () => {
    expect(english.duration(29)).toBe("1 d 5 h");
    expect(english.duration(48)).toBe("2 d");
    expect(romanian.duration(29)).toBe("1 z 5 h");
    expect(romanian.duration(48)).toBe("2 z");
  });

  it("uses the Romanian name of a place when there is one", () => {
    expect(romanian.own("Caribbean", "Caraibe")).toBe("Caraibe");
    expect(romanian.own("Santa Cruz de Tenerife", "")).toBe("Santa Cruz de Tenerife");
    expect(romanian.own("Santa Cruz de Tenerife", undefined)).toBe("Santa Cruz de Tenerife");
    expect(romanian.own("Caribbean", "   ")).toBe("Caribbean");
    expect(english.own("Caribbean", "Caraibe")).toBe("Caribbean");
  });

  it("splits a sentence around the part the page styles itself", () => {
    expect(english.parts("public.progress.sailed")).toEqual([{ slot: "distance" }, " sailed"]);
    expect(romanian.parts("public.weather.credit")).toEqual([
      "Date meteo de la ",
      { slot: "source" },
      ".",
    ]);
  });
});

describe("messages that come from the server", () => {
  const source = ["routes/voyage.py", "services/voyage_core.py"]
    .map((file) => readFileSync(new URL(`../../../backend/${file}`, import.meta.url), "utf8"))
    .join("\n");
  const fixed = [
    ...source.matchAll(/HTTPException\(\s*\d+,\s*"([^"]+)"/g),
    ...source.matchAll(/Image(?:Rejected|Busy)\(\s*"([^"]+)"/g),
    ...source.matchAll(/return False, "([^"]+)"/g),
  ].map((hit) => hit[1]);

  it("finds the server's messages in its source", () => {
    expect(fixed.length).toBeGreaterThan(30);
    expect(fixed).toContain("Wrong password");
    expect(fixed).toContain("that position is too old");
    expect(fixed).toContain("This file is not a readable photo");
  });

  it("has a Romanian text for every one of them", () => {
    expect(fixed.filter((message) => serverText("RO", message) === message)).toEqual([]);
  });

  it("covers the two messages the server puts a field name into", () => {
    expect(source).toContain('f"{label} is not a valid date and time"');
    expect(serverText("RO", "Departure is not a valid date and time")).toBe(
      "Plecarea nu este o dată și o oră valide"
    );
    expect(serverText("RO", "Arrival is not a valid date and time")).toBe(
      "Sosirea nu este o dată și o oră valide"
    );
  });

  it("leaves English alone, and anything it does not know", () => {
    expect(serverText("EN", "Wrong password")).toBe("Wrong password");
    expect(serverText("RO", "Wrong password")).toBe("Parolă greșită");
    expect(serverText("RO", "Something new")).toBe("Something new");
    expect(serverText("RO", "The server answered 502")).toBe("Serverul a răspuns 502");
  });

  it("translates what the outbox keeps about an entry that did not go", () => {
    const cases: [string, string][] = [
      ["One photo could not be sent", "O fotografie nu a putut fi trimisă"],
      ["Not accepted: that position is too old", "Neacceptat: poziția este prea veche"],
      [
        "Server: Photo storage is full. It will be tried again.",
        "Server: Spațiul pentru fotografii este plin. Se încearcă din nou.",
      ],
      ["Too many entries in an hour", "Prea multe însemnări într-o oră"],
    ];
    for (const [stored, shown] of cases) {
      expect(outboxErrorText("RO", stored)).toBe(shown);
      expect(outboxErrorText("EN", stored)).toBe(stored);
    }
  });
});

describe("every text can be produced", () => {
  it.each(["EN", "RO"] as VoyageLanguage[])("in %s, with nothing left unfilled", (language) => {
    const values = Object.fromEntries(
      keys.flatMap((key) => placeholders(forms(MESSAGES.EN[key])[0])).map((name) => [name, 3])
    );
    const unfilled = keys.filter((key) => /[{}]/.test(translate(language, key, values)));
    expect(unfilled).toEqual([]);
  });
});
