import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Prompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

interface PromptSelectorProps {
  prompts: Prompt[];
  selectedPrompt: Prompt | null;
  onPromptSelect: (prompt: Prompt) => void;
}

const PromptSelector = ({ prompts, selectedPrompt, onPromptSelect }: PromptSelectorProps) => {
  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="text-foreground">Select AI Prompt</CardTitle>
        <CardDescription className="text-muted-foreground">
          Choose from predefined prompts or start with a custom one
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={selectedPrompt?.id || ""}
          onValueChange={(value) => {
            const prompt = prompts.find(p => p.id === value);
            if (prompt) onPromptSelect(prompt);
          }}
        >
          <SelectTrigger className="w-full bg-input border-border text-foreground">
            <SelectValue placeholder="Choose a prompt template..." />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {prompts.map((prompt) => (
              <SelectItem 
                key={prompt.id} 
                value={prompt.id}
                className="text-popover-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{prompt.title}</span>
                  <span className="text-sm text-muted-foreground">{prompt.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {selectedPrompt && (
          <div className="mt-4 p-4 bg-secondary rounded-lg border border-border">
            <h4 className="font-medium text-secondary-foreground mb-2">{selectedPrompt.title}</h4>
            <p className="text-sm text-muted-foreground">{selectedPrompt.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PromptSelector;