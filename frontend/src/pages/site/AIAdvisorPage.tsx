import { FormEvent, useMemo, useState } from "react";
import { BrainCircuit, Lock, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { aiAdvisorPrompts } from "@/content/siteData";

type Message = {
  role: "user" | "assistant";
  text: string;
};

const PREVIEW_LIMIT = 2;

const buildAdvisorAnswer = (question: string) => {
  const lower = question.toLowerCase();

  const opening =
    "Strategic assessment: treat this as an operating model decision, not only a tooling choice.";

  const governance =
    "Define explicit decision rights for leadership, engineering managers, and technical reviewers before rollout.";

  const metrics =
    "Track adoption quality with a minimal KPI set: cycle reliability, review quality, escaped defects, and team-level confidence.";

  const compliance =
    "When compliance is relevant, move constraints into architecture decisions early and formalize release risk controls.";

  if (lower.includes("manager") || lower.includes("govern")) {
    return `${opening} ${governance} ${metrics}`;
  }

  if (lower.includes("architecture") || lower.includes("scale")) {
    return `${opening} Prioritize architecture constraints and sequencing first. ${compliance} ${metrics}`;
  }

  if (lower.includes("compliance") || lower.includes("einvoicing") || lower.includes("regulat")) {
    return `${opening} ${compliance} Build country or regulation-specific constraints into delivery planning, not post-hoc validation.`;
  }

  return `${opening} ${governance} ${metrics}`;
};

const AIAdvisorPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [context, setContext] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const assistantResponses = useMemo(
    () => messages.filter((message) => message.role === "assistant").length,
    [messages]
  );

  const previewLocked = !unlocked && assistantResponses >= PREVIEW_LIMIT;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!input.trim()) {
      return;
    }

    const nextMessages: Message[] = [...messages, { role: "user", text: input.trim() }];

    if (previewLocked) {
      nextMessages.push({
        role: "assistant",
        text: "Preview limit reached. Unlock deep-dive mode to receive tailored diagnostic guidance based on your organization context.",
      });
      setMessages(nextMessages);
      setInput("");
      return;
    }

    nextMessages.push({ role: "assistant", text: buildAdvisorAnswer(input) });
    setMessages(nextMessages);
    setInput("");
  };

  const unlockAdvisor = (event: FormEvent) => {
    event.preventDefault();

    if (!email.trim() || !organization.trim() || !context.trim()) {
      return;
    }

    setUnlocked(true);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        text: "Deep-dive mode unlocked. I will now tailor responses using your organization context. Next step after this chat: book a strategic triage session for a scoped engagement proposal.",
      },
    ]);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <section className="rounded-2xl border border-border bg-gradient-panel px-6 py-12 shadow-soft sm:px-10">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          AI Automation Assistant
        </Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">AI Automation Assistant</h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">
          Ask me about AI adoption, automation architecture, or n8n workflows. Preview is open and
          deep-dive mode stays available for tailored follow-up.
        </p>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Advisor Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 h-[360px] space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-background/70 p-4">
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
            </div>

            <form onSubmit={handleSubmit} className="flex gap-3">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about AI adoption, n8n automation, or EU AI Act..."
                className="bg-background/80"
              />
              <Button type="submit" className="rounded-full px-5">
                <Send className="h-4 w-4" />
              </Button>
            </form>

            {previewLocked ? (
              <p className="mt-3 text-xs text-amber-700">
                Preview limit reached. Unlock deep-dive mode to continue with tailored guidance.
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Preview mode: {PREVIEW_LIMIT - assistantResponses} structured responses remaining.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle className="font-heading text-xl">Starter Prompts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {aiAdvisorPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="w-full rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-xl">
                <Lock className="h-4 w-4" />
                Unlock Deep-Dive Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={unlockAdvisor} className="space-y-3">
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Work email"
                  required
                />
                <Input
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  placeholder="Organization"
                  required
                />
                <Textarea
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder="Current transformation challenge"
                  rows={4}
                  required
                />
                <Button type="submit" className="w-full rounded-full">
                  Unlock and Continue
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">
                Deep-dive mode is designed to qualify fit and route toward a paid working session.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default AIAdvisorPage;
