import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface ExampleInputProps {
  input: string;
  onInputChange: (input: string) => void;
}

const ExampleInput = ({ input, onInputChange }: ExampleInputProps) => {
  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="text-foreground">Input Data</CardTitle>
        <CardDescription className="text-muted-foreground">
          Provide the data that will be processed by the AI prompt
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="example-input" className="text-foreground font-medium">
            Your Input
          </Label>
          <Textarea
            id="example-input"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Enter your code, text, or data here..."
            className="min-h-[150px] bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-sm resize-y"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ExampleInput;