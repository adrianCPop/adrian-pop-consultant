import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResearchModalProps {
  open: boolean;
  onClose: () => void;
  htmlContent: string;
}

const ResearchModal = ({ open, onClose, htmlContent }: ResearchModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-4xl max-h-[80vh] w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Advanced Research</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div 
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      </div>
    </div>
  );
};

export default ResearchModal;