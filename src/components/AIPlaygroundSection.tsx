import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import PromptSelector from "./PromptSelector";
import PromptEditor from "./PromptEditor";
import ExampleInput from "./ExampleInput";
import SubmitButton from "./SubmitButton";
import ResultViewer from "./ResultViewer";
import { useToast } from "@/hooks/use-toast";
import promptsData from "@/data/prompts.json";

interface Prompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

const AIPlaygroundSection = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompts] = useState<Prompt[]>(promptsData);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!editedPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const processedPrompt = editedPrompt.replace(/\{\{input\}\}/g, userInput);

      setTimeout(() => {
        const dummyResponse = `# AI Analysis Result

Based on your prompt: "${selectedPrompt?.title || 'Custom Prompt'}"

## Analysis
The AI has processed your input and generated the following response:

\`\`\`
Input received: ${userInput.slice(0, 100)}${userInput.length > 100 ? '...' : ''}
Prompt executed: ${processedPrompt.slice(0, 100)}${processedPrompt.length > 100 ? '...' : ''}
\`\`\`

## Recommendations
1. The code structure looks good overall
2. Consider adding error handling for edge cases
3. Performance could be improved with caching
4. Security best practices are being followed

## Next Steps
- Implement the suggested improvements
- Add comprehensive unit tests
- Consider scalability requirements
- Review security implications

*This is a simulated response for demonstration purposes.*`;

        setResult(dummyResponse);
        setIsLoading(false);
        
        toast({
          title: "Success",
          description: "AI prompt executed successfully!",
        });
      }, 2000);

    } catch (error) {
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to execute prompt. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <section id="ai-playground" className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-accent/10 text-accent px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Interactive Demo</span>
            </div>
            
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Interactive AI Demo
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-6">
              See a small AI-powered tool I built to demonstrate XML validation, code review, and rule generation using OpenAI Codex.
            </p>
            
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 max-w-2xl mx-auto mb-8">
              <p className="text-accent font-medium">
                💡 This tool was built entirely using GPT-4 and Codex
              </p>
            </div>

            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="outline"
              className="border-border hover:bg-accent hover:text-accent-foreground"
            >
              {isExpanded ? (
                <>
                  Hide Demo
                  <ChevronUp className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Try the Demo
                  <ChevronDown className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Collapsible Demo */}
          {isExpanded && (
            <Card className="bg-card/50 backdrop-blur border-border shadow-card animate-fade-in">
              <CardHeader>
                <CardTitle className="text-foreground">AI Playground</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Prompt Selection */}
                <PromptSelector
                  prompts={prompts}
                  selectedPrompt={selectedPrompt}
                  onPromptSelect={(prompt) => {
                    setSelectedPrompt(prompt);
                    setEditedPrompt(prompt?.prompt || "");
                  }}
                />

                {/* Two-column layout for editor and input */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PromptEditor
                    prompt={editedPrompt}
                    onPromptChange={setEditedPrompt}
                  />
                  
                  <ExampleInput
                    input={userInput}
                    onInputChange={setUserInput}
                  />
                </div>

                {/* Submit Button */}
                <SubmitButton
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  disabled={!editedPrompt.trim()}
                />

                {/* Results */}
                <ResultViewer result={result} isLoading={isLoading} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
};

export default AIPlaygroundSection;