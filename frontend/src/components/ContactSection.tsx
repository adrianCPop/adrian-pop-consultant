import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Linkedin, Send, MessageCircle, Calendar, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { SUPABASE_URL } from "@/integrations/supabase/constants";

interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

const ContactSection = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const element = document.getElementById('contact');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  /**
   * Sends the contact form data to the Supabase edge function.
   */
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/sendContactEmail`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            message: formData.message,
            botField: '',
          }),
        });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const data: { success: boolean; error?: string } = await res.json();

      if (!data.success) {
        throw new Error(data.error ?? 'Unknown server error');
      }

      toast({
        title: t('contact.success.title'),
        description: t('contact.success.description'),
      });
      setFormData({ name: '', email: '', message: '' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Contact form error:', err);
      toast({
        title: t('contact.error.title'),
        description: t('contact.error.description'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <section id="contact" className="py-16 md:py-24 bg-gradient-subtle">
      <div className="container-mobile">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-card px-4 py-2 rounded-full border border-border mb-6 glass-effect">
              <MessageCircle className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-muted-foreground">Contact</span>
            </div>
            <h2 className="text-mobile-title font-bold text-foreground mb-4">
              {t('contact.title')}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t('contact.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Contact Info */}
            <div className={`space-y-8 transition-all duration-800 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
            }`}>
              <div>
                <h3 className="text-2xl font-semibold text-foreground mb-4">
                  {t('contact.getInTouch')}
                </h3>
                <p className="text-muted-foreground mb-6 text-base leading-relaxed">
                  {t('contact.intro')}
                </p>
              </div>

              {/* Contact Methods */}
              <div className="space-y-4">
                <a 
                  href="mailto:adrian.c.pop@gmail.com"
                  className="group flex items-center space-x-4 p-4 rounded-2xl bg-gradient-card border border-border hover:shadow-card-modern transition-all duration-300 hover:-translate-y-1 touch-manipulation"
                >
                  <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow-modern group-hover:scale-110 transition-transform duration-300">
                    <Mail className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground group-hover:text-primary transition-colors">Email</div>
                    <div className="text-sm text-muted-foreground">adrian.c.pop@gmail.com</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary ml-auto transition-colors" />
                </a>

                <a 
                  href="https://linkedin.com/in/adrian-c-pop"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center space-x-4 p-4 rounded-2xl bg-gradient-card border border-border hover:shadow-card-modern transition-all duration-300 hover:-translate-y-1 touch-manipulation"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl flex items-center justify-center shadow-glow-modern group-hover:scale-110 transition-transform duration-300">
                    <Linkedin className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground group-hover:text-primary transition-colors">LinkedIn</div>
                    <div className="text-sm text-muted-foreground">Professional Network</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary ml-auto transition-colors" />
                </a>

                {/* Calendar Booking */}
                <div className="group flex items-center space-x-4 p-4 rounded-2xl bg-gradient-card border border-border cursor-pointer hover:shadow-card-modern transition-all duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-xl flex items-center justify-center shadow-glow-modern group-hover:scale-110 transition-transform duration-300">
                    <Calendar className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground group-hover:text-primary transition-colors">Schedule a Call</div>
                    <div className="text-sm text-muted-foreground">Book a consultation</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary ml-auto transition-colors" />
                </div>
              </div>

              {/* Response Time */}
              <div className="bg-gradient-card p-6 rounded-2xl border border-border glass-effect">
                <h4 className="font-semibold text-foreground mb-2">Response Time</h4>
                <p className="text-sm text-muted-foreground">
                  I typically respond within 24 hours during business days. For urgent matters, feel free to reach out via LinkedIn.
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <Card className={`bg-gradient-card backdrop-blur-sm border-border shadow-card-modern transition-all duration-800 delay-200 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
            }`}>
              <CardHeader className="pb-6">
                <CardTitle className="text-foreground text-2xl">{t('contact.form.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="name" className="text-foreground text-sm font-medium mb-2 block">{t('contact.form.name')}</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="bg-background/50 border-border focus:border-primary h-12 touch-manipulation text-foreground placeholder:text-muted-foreground"
                      placeholder="Your full name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email" className="text-foreground text-sm font-medium mb-2 block">{t('contact.form.email')}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="bg-background/50 border-border focus:border-primary h-12 touch-manipulation text-foreground placeholder:text-muted-foreground"
                      placeholder="your.email@domain.com"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="message" className="text-foreground text-sm font-medium mb-2 block">{t('contact.form.message')}</Label>
                    <Textarea
                      id="message"
                      name="message"
                      rows={5}
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      className="bg-background/50 border-border focus:border-primary resize-none touch-manipulation"
                      placeholder="Tell me about your project, challenges, or how I can help..."
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-gradient-primary hover:shadow-glow-modern transition-all duration-300 hover:scale-105 h-12 touch-manipulation"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
                        Sending...
                      </div>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {t('contact.form.send')}
                      </>
                    )}
                  </Button>

                  {/* Privacy Note */}
                  <p className="text-xs text-muted-foreground text-center">
                    Your information is secure and will never be shared with third parties.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
