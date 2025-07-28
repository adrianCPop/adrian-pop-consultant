import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden bg-background/95 backdrop-blur-md border shadow-2xl rounded-2xl p-0 sm:p-6">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-2xl font-semibold text-foreground">
            Advanced Research
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(85vh-120px)] px-6 pb-6">
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