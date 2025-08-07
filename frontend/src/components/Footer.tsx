import LanguageSwitch from "./LanguageSwitch";
import { Linkedin, Mail, Github, Twitter } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="w-full border-t border-border bg-gradient-card backdrop-blur-sm">
      <div className="container-mobile py-8 md:py-12">
        <div className="flex flex-col space-y-8">
          {/* Top Section - Links and Social */}
          <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
            {/* Brand */}
            <div className="text-center md:text-left">
              <h3 className="text-xl font-bold text-foreground mb-2">Adrian Pop</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Technical consultant specializing in eInvoicing, AI compliance, and scalable systems.
              </p>
            </div>

            {/* Social Links */}
            <div className="flex items-center space-x-6">
              <a 
                href="mailto:adrian.c.pop@gmail.com"
                className="group p-3 rounded-xl bg-background/50 hover:bg-primary/10 hover:shadow-glow-modern transition-all duration-300 touch-manipulation"
                aria-label="Email"
              >
                <Mail className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
              
              <a 
                href="https://linkedin.com/in/adrian-c-pop"
                target="_blank"
                rel="noopener noreferrer"
                className="group p-3 rounded-xl bg-background/50 hover:bg-primary/10 hover:shadow-glow-modern transition-all duration-300 touch-manipulation"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>

              <a 
                href="https://github.com/adrian-c-pop"
                target="_blank"
                rel="noopener noreferrer"
                className="group p-3 rounded-xl bg-background/50 hover:bg-primary/10 hover:shadow-glow-modern transition-all duration-300 touch-manipulation"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>

              <a 
                href="https://twitter.com/adrian_c_pop"
                target="_blank"
                rel="noopener noreferrer"
                className="group p-3 rounded-xl bg-background/50 hover:bg-primary/10 hover:shadow-glow-modern transition-all duration-300 touch-manipulation"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 pt-6 border-t border-border">
            <div className="flex flex-wrap justify-center md:justify-start gap-6">
              <button
                onClick={() => {
                  const element = document.getElementById('services');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
              >
                Services
              </button>
              <button
                onClick={() => {
                  const element = document.getElementById('testimonials');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
              >
                Testimonials
              </button>
              <button
                onClick={() => {
                  const element = document.getElementById('publications');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
              >
                Publications
              </button>
              <button
                onClick={() => {
                  const element = document.getElementById('contact');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
              >
                Contact
              </button>
            </div>

            <LanguageSwitch />
          </div>

          {/* Bottom Section - Copyright */}
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center md:text-left">
              {t('footer.copyright')}
            </p>
            
            <div className="flex items-center space-x-4">
              <span className="text-xs text-muted-foreground">
                Made with ❤️ and modern tech
              </span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-muted-foreground">Available for new projects</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
