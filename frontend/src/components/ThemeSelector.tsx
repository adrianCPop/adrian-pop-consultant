import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette } from "lucide-react";

const STORAGE_KEY = "site_theme";

const DEFAULT_THEME = {
  primary: "#3c83f6",
  background: "#09090b",
  text: "#fafafa",
  accent: "#16a249",
};

const PRESET_THEMES = [
  { name: "Default", colors: DEFAULT_THEME },
  { name: "Ocean", colors: { primary: "#0ea5e9", background: "#0f172a", text: "#f8fafc", accent: "#06b6d4" } },
  { name: "Forest", colors: { primary: "#22c55e", background: "#0f1419", text: "#f0fdf4", accent: "#84cc16" } },
  { name: "Sunset", colors: { primary: "#f97316", background: "#1c1917", text: "#fef7f0", accent: "#ef4444" } },
  { name: "Purple", colors: { primary: "#8b5cf6", background: "#1e1b3a", text: "#f3f4f6", accent: "#a855f7" } },
];

type ThemeKeys = keyof typeof DEFAULT_THEME;

function applyTheme(theme: Record<ThemeKeys, string>) {
  for (const [key, value] of Object.entries(theme)) {
    document.documentElement.style.setProperty(`--color-${key}`, value);
  }
}

const ThemeSelector = () => {
  const [colors, setColors] = useState(DEFAULT_THEME);
  const [isOpen, setIsOpen] = useState(false);

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

  const handlePresetSelect = (preset: typeof PRESET_THEMES[0]) => {
    setColors(preset.colors);
    applyTheme(preset.colors);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preset.colors));
    setIsOpen(false);
  };

  const handleColorChange = (key: ThemeKeys) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">Theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 space-y-4" align="end">
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Color Themes</h3>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_THEMES.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                size="sm"
                onClick={() => handlePresetSelect(preset)}
                className="justify-start gap-2 h-8"
              >
                <div className="flex gap-1">
                  <div 
                    className="w-3 h-3 rounded-full border border-border/50"
                    style={{ backgroundColor: preset.colors.primary }}
                  />
                  <div 
                    className="w-3 h-3 rounded-full border border-border/50"
                    style={{ backgroundColor: preset.colors.accent }}
                  />
                </div>
                <span className="text-xs">{preset.name}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t pt-3">
          <h3 className="font-semibold text-sm">Custom Colors</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm">Primary</label>
              <input 
                type="color" 
                value={colors.primary} 
                onChange={handleColorChange("primary")}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Background</label>
              <input 
                type="color" 
                value={colors.background} 
                onChange={handleColorChange("background")}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Text</label>
              <input 
                type="color" 
                value={colors.text} 
                onChange={handleColorChange("text")}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Accent</label>
              <input 
                type="color" 
                value={colors.accent} 
                onChange={handleColorChange("accent")}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetTheme} className="w-full">
            Reset to Default
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ThemeSelector;