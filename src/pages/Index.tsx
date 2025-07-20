import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PromptSelector from "@/components/PromptSelector";
import PromptEditor from "@/components/PromptEditor";
import ExampleInput from "@/components/ExampleInput";
import SubmitButton from "@/components/SubmitButton";
import ResultViewer from "@/components/ResultViewer";
import { useToast } from "@/hooks/use-toast";
import promptsData from "@/data/prompts.json";

interface Prompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

const Index = () => {
  const [prompts] = useState<Prompt[]>(promptsData);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedPrompt) {
      setEditedPrompt(selectedPrompt.prompt);
    }
  }, [selectedPrompt]);

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
      // Replace {{input}} with actual user input
      const processedPrompt = editedPrompt.replace(/\{\{input\}\}/g, userInput);

      // Simulate API call
      const response = await fetch('/api/execute-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: processedPrompt,
          input: userInput,
        }),
      });

      // Since this is a demo, simulate a response
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
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Prompt Selection */}
          <PromptSelector
            prompts={prompts}
            selectedPrompt={selectedPrompt}
            onPromptSelect={setSelectedPrompt}
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
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
