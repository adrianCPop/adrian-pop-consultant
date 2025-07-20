import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle } from "lucide-react";
import { useState } from "react";

interface ResultViewerProps {
  result: string | null;
  isLoading: boolean;
}

const ResultViewer = ({ result, isLoading }: ResultViewerProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (result) {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="text-foreground">AI Response</CardTitle>
          <CardDescription className="text-muted-foreground">
            Processing your request...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-code-bg border border-code-border rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-100"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-200"></div>
              <span className="text-muted-foreground text-sm ml-2">AI is thinking...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="bg-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="text-foreground">AI Response</CardTitle>
          <CardDescription className="text-muted-foreground">
            The AI response will appear here after execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-code-bg border border-code-border rounded-lg p-6 text-center">
            <p className="text-muted-foreground">No results yet. Execute a prompt to see the AI response.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground">AI Response</CardTitle>
            <CardDescription className="text-muted-foreground">
              Generated result from your prompt
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="border-border hover:bg-accent hover:text-accent-foreground"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-code-bg border border-code-border rounded-lg p-4 max-h-96 overflow-y-auto">
          <pre className="font-mono text-sm text-foreground whitespace-pre-wrap break-words">
            {result}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultViewer;