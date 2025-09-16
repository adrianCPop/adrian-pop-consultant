
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect } from "react";
import { X, ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";

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
  // Disable body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.setAttribute('data-scroll-locked', 'true');
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.removeAttribute('data-scroll-locked');
      document.body.classList.remove('overflow-hidden');
    }

    return () => {
      document.body.removeAttribute('data-scroll-locked');
      document.body.classList.remove('overflow-hidden');
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full mx-4 max-h-[85vh] bg-background border shadow-2xl rounded-2xl p-8 animate-fade-in">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-2xl font-semibold text-foreground">
            Advanced Research
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(85vh-180px)]">
          <div 
            className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-li:text-foreground space-y-4" 
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default ResearchModal;
