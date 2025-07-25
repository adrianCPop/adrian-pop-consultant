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
  return <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/95" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-xl shadow-xl max-w-2xl max-h-[85vh] w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-slate-400">
          <h2 className="text-xl font-semibold text-zinc-50">Advanced Research</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 bg-slate-500 hover:bg-slate-400">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-88px)] bg-slate-100">
          <div className="prose prose-base max-w-none prose-headings:text-card-foreground prose-p:text-card-foreground prose-p:leading-relaxed prose-strong:text-card-foreground prose-li:text-card-foreground" dangerouslySetInnerHTML={{
          __html: htmlContent
        }} />
        </div>
      </div>
    </div>;
};
export default ResearchModal;