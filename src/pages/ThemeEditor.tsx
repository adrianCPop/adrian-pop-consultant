import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "site_theme";

const DEFAULT_THEME = {
  primary: "#3c83f6",
  background: "#09090b",
  text: "#fafafa",
  accent: "#16a249",
};

type ThemeKeys = keyof typeof DEFAULT_THEME;

function applyTheme(theme: Record<ThemeKeys, string>) {
  for (const [key, value] of Object.entries(theme)) {
    document.documentElement.style.setProperty(`--color-${key}`, value);
  }
}

const ThemeEditor = () => {
  const [colors, setColors] = useState(DEFAULT_THEME);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<Record<ThemeKeys, string>>;
        const merged = { ...DEFAULT_THEME, ...parsed };
        setColors(merged);
        applyTheme(merged);
      } catch (err) {
        console.error("Failed to parse stored theme", err);
        applyTheme(DEFAULT_THEME);
      }
    } else {
      applyTheme(DEFAULT_THEME);
    }
  }, []);

  const handleChange = (key: ThemeKeys) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const newTheme = { ...colors, [key]: value } as Record<ThemeKeys, string>;
    setColors(newTheme);
    applyTheme(newTheme);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTheme));
  };

  const resetTheme = () => {
    setColors(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="min-h-screen p-6 space-y-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold">Theme Editor</h1>

      <div className="grid gap-4 max-w-sm">
        <label className="flex items-center justify-between">
          <span>Primary color</span>
          <input type="color" value={colors.primary} onChange={handleChange("primary")}/>
        </label>
        <label className="flex items-center justify-between">
          <span>Background color</span>
          <input type="color" value={colors.background} onChange={handleChange("background")}/>
        </label>
        <label className="flex items-center justify-between">
          <span>Text color</span>
          <input type="color" value={colors.text} onChange={handleChange("text")}/>
        </label>
        <label className="flex items-center justify-between">
          <span>Accent color</span>
          <input type="color" value={colors.accent} onChange={handleChange("accent")}/>
        </label>
      </div>

      <div className="p-6 rounded-lg shadow-card bg-primary text-text space-y-4">
        <h2 className="text-xl font-semibold">Preview Card</h2>
        <p>This card updates as you change the colors.</p>
        <Button className="bg-accent text-text hover:opacity-90">Example Button</Button>
      </div>

      <Button variant="destructive" onClick={resetTheme}>Reset to Default</Button>
    </div>
  );
};

export default ThemeEditor;
