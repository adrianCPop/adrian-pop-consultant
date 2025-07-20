import LanguageSwitch from "./LanguageSwitch";
import { Cpu } from "lucide-react";

const Header = () => {
  return (
    <header className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-primary rounded-lg shadow-glow">
              <Cpu className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Adrian Pop AI Playground
            </h1>
          </div>
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
};

export default Header;