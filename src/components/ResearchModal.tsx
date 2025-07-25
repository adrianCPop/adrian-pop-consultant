import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResearchModalProps {
  open: boolean;
  onClose: () => void;
  htmlContent: string;
}

const ResearchModal = ({
  open,
  onClose,
  htmlContent
}: ResearchModalProps) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Backdrop with gradient */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/90 to-muted/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal with enhanced styling */}
      <div className="relative bg-gradient-to-br from-card via-card/95 to-muted/20 border border-border/50 rounded-2xl shadow-2xl max-w-2xl max-h-[85vh] w-full mx-4 overflow-hidden backdrop-blur-md animate-scale-in">
        {/* Header with gradient accent */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-secondary/5" />
          <div className="relative flex items-center justify-between p-6 border-b border-border/30 backdrop-blur-sm">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              Advanced Research
            </h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="h-8 w-8 hover:bg-muted/50 rounded-full transition-all duration-200 hover:scale-110"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Content with enhanced styling */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/5 to-muted/10" />
          <div className="relative p-6 overflow-y-auto max-h-[calc(85vh-88px)] bg-background/50 backdrop-blur-sm">
            <div 
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              className="prose prose-base max-w-none 
                prose-headings:text-foreground prose-headings:font-semibold 
                prose-p:text-foreground/90 prose-p:leading-relaxed 
                prose-strong:text-foreground prose-strong:font-medium
                prose-li:text-foreground/90 
                prose-a:text-primary hover:prose-a:text-primary/80
                prose-blockquote:border-l-primary/30 prose-blockquote:text-foreground/80
                prose-code:text-primary prose-code:bg-muted/50 prose-code:rounded prose-code:px-1
                [&>*]:transition-all [&>*]:duration-200"
            />
          </div>
        </div>
        
        {/* Subtle bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </div>
  );
};
export default ResearchModal;