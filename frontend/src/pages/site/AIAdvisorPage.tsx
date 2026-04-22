import { FormEvent, useRef, useMemo, useState, useCallback } from "react";
import { BrainCircuit, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { aiAdvisorPrompts } from "@/content/siteData";

const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_CHAT_WEBHOOK_URL as string | undefined;

type Message = {
  role: "user" | "assistant";
  text: string;
};

function generateSessionId() {
  return `advisor-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extractText(body: unknown): string {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (typeof obj.output === "string") return obj.output;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.response === "string") return obj.response;
    const content = obj.content as Record<string, unknown> | undefined;
    if (content && Array.isArray(content.parts) && content.parts.length > 0) {
      const part = content.parts[0] as Record<string, unknown>;
      if (typeof part.text === "string") return part.text;
    }
  }
  if (Array.isArray(body) && body.length > 0) {
    const first = body[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const obj = first as Record<string, unknown>;
      if (typeof obj.output === "string") return obj.output;
      if (typeof obj.text === "string") return obj.text;
    }
  }
  return "Sorry, I couldn't process that response.";
}

const AIAdvisorPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const sessionId = useRef(generateSessionId());

  const assistantCount = useMemo(
    () => messages.filter((m) => m.role === "assistant").length,
    [messages]
  );

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: text.trim() }]);
    setIsTyping(true);

    if (!N8N_WEBHOOK_URL) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Chat is not configured. Please set VITE_N8N_CHAT_WEBHOOK_URL." },
      ]);
      setIsTyping(false);
      return;
    }

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sendMessage",
          sessionId: sessionId.current,
          chatInput: text.trim(),
          message: text.trim(),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: unknown = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", text: extractText(data) }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Sorry, I had trouble connecting. Please try again." },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <section className="rounded-2xl border border-border bg-gradient-panel px-6 py-12 shadow-soft sm:px-10">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          AI Automation Assistant
        </Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">AI Automation Assistant</h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">
          Ask me about AI adoption, automation architecture, or n8n workflows. Powered by Adi's personal AI assistant.
        </p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Advisor Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 h-[400px] space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-background/70 p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                  <BrainCircuit className="mb-3 h-8 w-8 text-primary" />
                  Describe your automation challenge and I&apos;ll tell you how AI and n8n can help.
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground"
                    }`}
                  >
                    {message.text}
                  </div>
                ))
              )}
              {isTyping && (
                <div className="flex gap-1 rounded-xl bg-card px-3 py-3 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-3">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about AI adoption, n8n automation, or EU AI Act..."
                className="bg-background/80"
                disabled={isTyping}
              />
              <Button type="submit" disabled={!input.trim() || isTyping} className="rounded-full px-5">
                <Send className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-3 text-xs text-muted-foreground">
              {assistantCount > 0
                ? `${assistantCount} response${assistantCount > 1 ? "s" : ""} in this session`
                : "Ask anything about AI adoption, automation, or Adi's services."}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Starter Prompts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {aiAdvisorPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                disabled={isTyping}
                className="w-full rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default AIAdvisorPage;
