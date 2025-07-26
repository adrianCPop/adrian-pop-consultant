import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Advanced Research</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] pr-6">
          <div 
            className="prose prose-base max-w-none prose-headings:text-foreground prose-p:text-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-li:text-foreground" 
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default ResearchModal;