import LanguageSwitch from "./LanguageSwitch";
import ThemeSelector from "./ThemeSelector";
import { Cpu, Menu, X, ChevronDown } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const Header = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { href: "#services", label: "Services" },
    { href: "#testimonials", label: "Testimonials" },
    { href: "#publications", label: "Publications" },
    { href: "#contact", label: "Contact" }
  ];

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId.replace('#', ''));
    element?.scrollIntoView({ behavior: 'smooth' });
    setIsOpen(false);
  };

  const MobileNavContent = () => (
    <div className="flex flex-col space-y-6 pt-8">
      {/* Navigation Links */}
      <nav className="flex flex-col space-y-4">
        {navItems.map((item) => (
          <button
            key={item.href}
            onClick={() => scrollToSection(item.href)}
            className="text-left text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
          >
            {item.label}
          </button>
        ))}
        
        {/* Fiscal Alerts Dropdown */}
        <div className="border-t border-border pt-4 mt-4">
          <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
            {t('fiscalAlerts.myWork')}
          </p>
          <Link 
            to="/fiscal-alerts" 
            onClick={() => setIsOpen(false)}
            className="block text-lg font-medium text-foreground hover:text-primary transition-colors py-2"
          >
            {t('fiscalAlerts.fiscalAlertsNav')}
          </Link>
        </div>
      </nav>

      {/* Theme and Language Controls */}
      <div className="border-t border-border pt-6 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Theme</span>
          <ThemeSelector />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Language</span>
          <LanguageSwitch />
        </div>
      </div>
    </div>
  );
  
  return (
    <header 
      className={`w-full fixed top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-background/95 backdrop-blur-lg border-b border-border shadow-card-modern' 
          : 'bg-transparent'
      }`}
    >
      <div className="container-mobile">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 touch-manipulation tap-highlight-none">
            <div className="p-2 bg-gradient-primary rounded-xl shadow-glow-modern">
              <Cpu className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {t('header.title')}
            </h1>
          </Link>
          
          {/* Desktop Navigation */}
          {!isMobile && (
            <div className="flex items-center space-x-8">
              <nav className="flex items-center space-x-6">
                {navItems.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => scrollToSection(item.href)}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 text-sm font-medium">
                      {t('fiscalAlerts.myWork')}
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="glass-effect">
                    <DropdownMenuItem asChild>
                      <Link 
                        to="/fiscal-alerts" 
                        className="w-full cursor-pointer hover:bg-accent/10"
                      >
                        {t('fiscalAlerts.fiscalAlertsNav')}
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </nav>
              
              <div className="flex items-center gap-3">
                <ThemeSelector />
                <LanguageSwitch />
              </div>
            </div>
          )}

          {/* Mobile Menu */}
          {isMobile && (
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="touch-manipulation tap-highlight-none"
                  aria-label="Open menu"
                >
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-80 bg-gradient-card border-l border-border">
                <SheetHeader>
                  <SheetTitle className="text-left flex items-center space-x-3">
                    <div className="p-2 bg-gradient-primary rounded-lg shadow-glow-modern">
                      <Cpu className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span>{t('header.title')}</span>
                  </SheetTitle>
                </SheetHeader>
                <MobileNavContent />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
