import { LANGUAGES, LANGUAGE_NAMES } from "@/lib/voyageI18n";
import { useVoyageTexts } from "@/lib/useVoyageTexts";
import { cn } from "@/lib/utils";

/** English or Romanian, for the voyage pages. The choice is remembered on the device. */
const VoyageLanguageSwitch = ({ className }: { className?: string }) => {
  const { language, setLanguage, t } = useVoyageTexts();

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg border border-border/80 bg-secondary/40 p-0.5",
        className
      )}
    >
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          // Each language is named in itself, so it is read out properly.
          lang={code.toLowerCase()}
          title={LANGUAGE_NAMES[code]}
          aria-label={LANGUAGE_NAMES[code]}
          aria-pressed={language === code}
          onClick={() => setLanguage(code)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            language === code
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
};

export default VoyageLanguageSwitch;
