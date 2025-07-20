import { Code2, Bot } from "lucide-react";

const Footer = () => {
  return (
    <footer className="w-full border-t border-border bg-background/95 backdrop-blur">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center space-x-2 text-muted-foreground">
          <span className="text-sm">Page built with</span>
          <div className="flex items-center space-x-1">
            <Code2 className="w-4 h-4" />
            <span className="text-sm font-medium">Codex</span>
          </div>
          <span className="text-sm">and</span>
          <div className="flex items-center space-x-1">
            <Bot className="w-4 h-4" />
            <span className="text-sm font-medium">GPT-4</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;