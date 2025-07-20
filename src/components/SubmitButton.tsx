import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";

interface SubmitButtonProps {
  onSubmit: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

const SubmitButton = ({ onSubmit, isLoading, disabled }: SubmitButtonProps) => {
  return (
    <div className="flex justify-center">
      <Button
        onClick={onSubmit}
        disabled={disabled || isLoading}
        className="bg-gradient-primary hover:opacity-90 text-primary-foreground font-medium px-8 py-3 h-auto shadow-glow transition-all duration-200 hover:shadow-lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Execute Prompt
          </>
        )}
      </Button>
    </div>
  );
};

export default SubmitButton;