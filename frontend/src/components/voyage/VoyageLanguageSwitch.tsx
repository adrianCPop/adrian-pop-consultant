import { LANGUAGES, LANGUAGE_LABELS, LANGUAGE_NAMES, type VoyageLanguage } from "@/lib/voyageI18n";
import { useVoyageTexts } from "@/lib/useVoyageTexts";
import { cn } from "@/lib/utils";

/**
 * The language of a voyage page. The choice is remembered on the device. A page
 * that has fewer languages names them in `languages`; a visitor who chose one it
 * does not have reads it in English there.
 */
const VoyageLanguageSwitch = ({
  className,
  languages = LANGUAGES,
}: {
  className?: string;
  languages?: VoyageLanguage[];
}) => {
  const { language, setLanguage, t } = useVoyageTexts();
  const shown = languages.includes(language) ? language : "EN";

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg border border-border/80 bg-secondary/40 p-0.5",
        className
      )}
    >
      {languages.map((code) => (
        <button
          key={code}
          type="button"
          // Each language is named in itself, so it is read out properly.
          lang={code === "DA" ? "da" : code.toLowerCase()}
          title={LANGUAGE_NAMES[code]}
          aria-label={LANGUAGE_NAMES[code]}
          aria-pressed={shown === code}
          onClick={() => setLanguage(code)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            shown === code
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {LANGUAGE_LABELS[code]}
        </button>
      ))}
    </div>
  );
};

export default VoyageLanguageSwitch;
