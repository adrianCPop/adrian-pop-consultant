
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
  const [copied, setCopied] = useState(false);

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

  // Clean HTML content for better rendering
  const cleanHtmlContent = (html: string) => {
    // Remove any inline styles that might conflict with dark mode
    return html
      .replace(/style="[^"]*"/gi, '')
      .replace(/color:\s*[^;]*;/gi, '')
      .replace(/background-color:\s*[^;]*;/gi, '')
      .replace(/background:\s*[^;]*;/gi, '');
  };

  const copyToClipboard = async () => {
    try {
      // Extract text content from HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full mx-4 max-h-[90vh] bg-gradient-card backdrop-blur-sm border-border shadow-card-hover rounded-2xl p-0 animate-fade-in">
        {/* Header */}
        <DialogHeader className="px-8 py-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-semibold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-blue-400" />
              </div>
              Advanced Research
            </DialogTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-secondary/50 hover:bg-secondary/70 border border-border rounded-lg transition-colors duration-300"
                title="Copy research content"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-green-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center w-8 h-8 bg-secondary/50 hover:bg-secondary/70 border border-border rounded-lg transition-colors duration-300"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] px-8 py-6">
          <div 
            className="research-content prose prose-lg max-w-none 
            prose-headings:text-foreground prose-headings:font-semibold prose-headings:mb-4 prose-headings:mt-6
            prose-h1:text-3xl prose-h1:border-b prose-h1:border-border/30 prose-h1:pb-2
            prose-h2:text-2xl prose-h2:text-accent
            prose-h3:text-xl prose-h3:text-foreground/90
            prose-p:text-foreground/80 prose-p:leading-relaxed prose-p:mb-4
            prose-strong:text-foreground prose-strong:font-semibold
            prose-em:text-foreground/70 prose-em:italic
            prose-li:text-foreground/80 prose-li:mb-2
            prose-ul:my-4 prose-ol:my-4
            prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:bg-secondary/20 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:text-foreground/70
            prose-code:bg-secondary/30 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-accent prose-code:text-sm
            prose-pre:bg-secondary/20 prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto
            prose-a:text-accent prose-a:underline prose-a:decoration-accent/30 hover:prose-a:decoration-accent/60 prose-a:transition-colors
            prose-table:w-full prose-table:border-collapse prose-table:my-6
            prose-th:bg-secondary/30 prose-th:border prose-th:border-border prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-foreground
            prose-td:border prose-td:border-border prose-td:px-4 prose-td:py-2 prose-td:text-foreground/80
            prose-hr:border-border/50 prose-hr:my-6
            space-y-4" 
            dangerouslySetInnerHTML={{ __html: cleanHtmlContent(htmlContent) }} 
          />
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border/50 bg-secondary/10">
          <p className="text-sm text-muted-foreground text-center">
            💡 This research content has been optimized for readability across all themes
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default ResearchModal;
