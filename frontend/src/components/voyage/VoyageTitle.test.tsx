import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VoyageTitle from "./VoyageTitle";

describe("public tracker heading", () => {
  for (const language of ["RO", "EN"] as const) {
    it(`uses the configured ports in ${language} and reserves Apolodor for Romanian`, () => {
      const html = renderToStaticMarkup(
        <VoyageTitle language={language} origin="Puerto Colón" destination="Martinica" to="→" />
      );
      expect(html).toContain("Puerto Colón");
      expect(html).toContain("Martinica");
      expect(html.includes("Apolodor pe Atlantic")).toBe(language === "RO");
      expect(html.includes("apolodor-ketch")).toBe(language === "RO");
    });
  }
});
