import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface LanguageSwitchProps {
  className?: string;
}

const LanguageSwitch = ({ className }: LanguageSwitchProps) => {
  const { language, setLanguage } = useTranslation();

  const toggleLanguage = () => {
    setLanguage(language === 'EN' ? 'RO' : 'EN');
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className={`border-border hover:bg-accent hover:text-accent-foreground ${className}`}
    >
      <Globe className="w-4 h-4 mr-2" />
      {language}
    </Button>
  );
};

export default LanguageSwitch;