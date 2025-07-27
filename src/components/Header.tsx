import LanguageSwitch from "./LanguageSwitch";
import ThemeSelector from "./ThemeSelector";
import { Cpu, ChevronDown } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Link, useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const Header = () => {
  const { t } = useTranslation();
  const location = useLocation();
  
  return (
    <header className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-primary rounded-lg shadow-glow">
                <Cpu className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('header.title')}
              </h1>
            </Link>
            
            {/* Navigation Menu */}
            <nav className="flex items-center space-x-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    {t('fiscalAlerts.myWork')}
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-background border border-border">
                  <DropdownMenuItem asChild>
                    <Link 
                      to="/fiscal-alerts" 
                      className="w-full cursor-pointer hover:bg-accent"
                    >
                      {t('fiscalAlerts.fiscalAlertsNav')}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeSelector />
            <LanguageSwitch />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;