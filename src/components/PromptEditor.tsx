import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface PromptEditorProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
}

const PromptEditor = ({ prompt, onPromptChange }: PromptEditorProps) => {
  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="text-foreground">Edit Prompt</CardTitle>
        <CardDescription className="text-muted-foreground">
          Customize the prompt template. Use {"{{"+"input"+"}}"} to reference user input.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="prompt-editor" className="text-foreground font-medium">
            Prompt Template
          </Label>
          <Textarea
            id="prompt-editor"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Enter your AI prompt here..."
            className="min-h-[200px] bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-sm resize-y"
          />
          <p className="text-xs text-muted-foreground">
            Tip: Use {"{{"+"input"+"}}"} in your prompt to insert user-provided data
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PromptEditor;