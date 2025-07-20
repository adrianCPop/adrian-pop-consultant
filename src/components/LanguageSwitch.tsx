import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useState } from "react";

interface LanguageSwitchProps {
  className?: string;
}

const LanguageSwitch = ({ className }: LanguageSwitchProps) => {
  const [language, setLanguage] = useState<'EN' | 'RO'>('EN');

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'EN' ? 'RO' : 'EN');
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