import LanguageSwitch from "./LanguageSwitch";
import { Linkedin, Mail } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="w-full border-t border-border bg-background/95 backdrop-blur">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row items-center justify-between space-y-6 lg:space-y-0">
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <p className="text-sm text-muted-foreground">
              {t('footer.copyright')}
            </p>
            
            <div className="flex items-center space-x-4">
              <a 
                href="mailto:adrian.c.pop@gmail.com"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="Email"
              >
                <Mail className="w-4 h-4" />
              </a>
              <a 
                href="https://linkedin.com/in/adrian-c-pop"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
          
          <LanguageSwitch />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
