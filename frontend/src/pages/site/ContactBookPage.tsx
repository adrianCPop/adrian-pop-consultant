import { FormEvent, useState } from "react";
import { BookOpen, Linkedin, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/constants";

interface IntakeFormState {
  name: string;
  email: string;
  role: string;
  organization: string;
  orgSize: string;
  challenge: string;
  urgency: string;
  region: string;
  message: string;
}

const initialForm: IntakeFormState = {
  name: "",
  email: "",
  role: "",
  organization: "",
  orgSize: "",
  challenge: "",
  urgency: "",
  region: "",
  message: "",
};

const ContactBookPage = () => {
  const [form, setForm] = useState<IntakeFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const setField = (field: keyof IntakeFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);

    const structuredMessage = [
      `Role: ${form.role}`,
      `Organization: ${form.organization}`,
      `Organization Size: ${form.orgSize}`,
      `Primary Challenge: ${form.challenge}`,
      `Urgency: ${form.urgency}`,
      `Region: ${form.region}`,
      "---",
      form.message,
    ].join("\n");

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/sendContactEmail`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          message: structuredMessage,
          botField: "",
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      toast({
        title: "Request submitted",
        description: "Thanks. You should receive a response within one business day.",
      });
      setForm(initialForm);
    } catch (error) {
      console.error("Failed to submit contact request", error);
      toast({
        title: "Submission error",
        description: "Unable to submit right now. Please try again or email directly.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <section className="rounded-2xl border border-border bg-gradient-panel px-6 py-12 shadow-soft sm:px-10">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          Contact and Booking
        </Badge>
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Let&apos;s talk about AI adoption for your organisation</h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          Whether you&apos;re evaluating AI tools, building automation workflows, or navigating EU AI
          Act compliance, I&apos;m happy to have a no-commitment conversation.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="mailto:adrian.c.pop@gmail.com"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Mail className="h-4 w-4" />
            adrian.c.pop@gmail.com
          </a>
          <a
            href="https://www.linkedin.com/in/adrian-c-pop/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Linkedin className="h-4 w-4" />
            LinkedIn
          </a>
          <a
            href="https://medium.com/@adrian.c.pop"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <BookOpen className="h-4 w-4" />
            Medium
          </a>
        </div>
      </section>

      <Card className="mt-10 border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Strategic Intake</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={form.name} onChange={(event) => setField("name", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setField("email", event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  required
                  placeholder="CTO, VP Engineering, Engineering Manager..."
                  value={form.role}
                  onChange={(event) => setField("role", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  required
                  value={form.organization}
                  onChange={(event) => setField("organization", event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="orgSize">Organization size</Label>
                <Input
                  id="orgSize"
                  required
                  placeholder="e.g. 50 engineers"
                  value={form.orgSize}
                  onChange={(event) => setField("orgSize", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="urgency">Urgency</Label>
                <Input
                  id="urgency"
                  required
                  placeholder="2 weeks, this quarter..."
                  value={form.urgency}
                  onChange={(event) => setField("urgency", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  required
                  placeholder="EU, US, Global..."
                  value={form.region}
                  onChange={(event) => setField("region", event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="challenge">Primary transformation challenge</Label>
              <Textarea
                id="challenge"
                required
                rows={4}
                placeholder="Describe the bottleneck blocking AI adoption or delivery performance."
                value={form.challenge}
                onChange={(event) => setField("challenge", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Additional context</Label>
              <Textarea
                id="message"
                rows={5}
                placeholder="Any extra details, constraints, stakeholders, or expected outcomes."
                value={form.message}
                onChange={(event) => setField("message", event.target.value)}
              />
            </div>

            <Button type="submit" disabled={submitting} className="rounded-full px-6 sm:w-fit">
              {submitting ? "Submitting..." : "Submit Strategic Intake"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactBookPage;
