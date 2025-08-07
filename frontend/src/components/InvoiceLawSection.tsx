import { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Play, Save, CheckCircle, XCircle, AlertTriangle, ChevronDown, Loader2, MessageCircle, Brain, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/constants";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  ruleLog: {
    rule: number;
    passed: boolean;
  }[];
  // Legacy support
  success?: boolean;
  results?: {
    ruleId: string;
    passed: boolean;
    message: string;
  }[];
  error?: string;
}





const InvoiceLawSection = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  
  // Chat-related state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Handle chat form submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      text: chatInput,
      isUser: true,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    const currentInput = chatInput;
    setChatInput("");
    setIsTyping(true);

    try {
      console.log('Sending message to n8n:', currentInput);
      
      // Your n8n webhook URL
      const n8nWebhookUrl = "https://n8n.srv923194.hstgr.cloud/webhook/e1fbbe47-646f-4864-bd4e-666f6866430a/chat";
      
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          sessionId: user?.id || 'anonymous',
          timestamp: new Date().toISOString()
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('N8N response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to get response from AI'}`);
      }

      const data = await response.json();
      console.log('N8N response data:', data);
      
      // Handle different possible response formats from n8n
      let responseText = '';
      if (data.response) {
        responseText = data.response;
      } else if (data.message) {
        // Check if it's an error message
        if (data.message === "Error in workflow") {
          responseText = "I'm sorry, there seems to be an issue with my AI workflow. The system returned 'Error in workflow'. Please check the n8n workflow configuration or try a different question.";
        } else {
          responseText = data.message;
        }
      } else if (data.text) {
        responseText = data.text;
      } else if (typeof data === 'string') {
        responseText = data;
      } else {
        responseText = `I received an unexpected response format: ${JSON.stringify(data)}. Please check the n8n workflow output format.`;
      }

      const aiMessage: ChatMessage = {
        text: responseText,
        isUser: false,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error details:', error);
      
      let errorMessage = "I'm experiencing some technical difficulties. ";
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage += "Unable to connect to the AI service. Please check your internet connection and try again.";
        } else if (error.message.includes('HTTP')) {
          errorMessage += `Server responded with: ${error.message}. Please try again later.`;
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += "An unexpected error occurred. Please try again later or contact support.";
      }
      
      const aiErrorMessage: ChatMessage = {
        text: errorMessage,
        isUser: false,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, aiErrorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle quick action buttons
  const handleQuickAction = (suggestion: string) => {
    if (isTyping) return;
    setChatInput(suggestion);
  };

  useEffect(() => {
    // Check for authenticated user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);



  return (
    <section id="invoice-law" className="py-16 md:py-24 bg-gradient-subtle">
      <div className="container-mobile">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-card px-4 py-2 rounded-full border border-border mb-6 glass-effect">
              <Play className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-muted-foreground">Interactive Demo</span>
            </div>
            <h2 className="text-mobile-title font-bold text-foreground mb-4">
              Can you beat Adrian's logic?
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Build your own invoice validation rules and test them against real JSON data. 
              See if you can create logic as robust as what I've built for enterprise clients.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {/* AI Chat Bot - Full Width */}
            <Card className="bg-gradient-card backdrop-blur-sm border-border shadow-card-modern">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow-modern">
                    <MessageCircle className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground text-xl">AI Invoice Assistant</CardTitle>
                    <p className="text-sm text-muted-foreground">Ask me about invoice validation, compliance, or eInvoicing</p>
                  </div>
                  <div className="ml-auto">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Chat Messages Area */}
                <div className="h-80 md:h-96 overflow-y-auto p-4 space-y-4 bg-background/20 border-y border-border">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 shadow-glow-modern">
                        <Brain className="w-8 h-8 text-primary-foreground" />
                      </div>
                      <p className="text-muted-foreground mb-2">Describe your problem and let's see if my AI assistant thinks that I can help</p>
                    </div>
                  ) : (
                    chatMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            message.isUser
                              ? 'bg-gradient-primary text-primary-foreground'
                              : 'bg-background/80 border border-border text-foreground'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.text}</p>
                          <span className="text-xs opacity-70 mt-1 block">
                            {format(message.timestamp, 'HH:mm')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* Typing Indicator */}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-background/80 border border-border rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-4">
                  <form onSubmit={handleChatSubmit} className="flex gap-3">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask about invoice validation, compliance, or eInvoicing..."
                      disabled={isTyping}
                      className="flex-1 h-12 px-4 rounded-xl bg-background/50 border border-border focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground touch-manipulation"
                    />
                    <Button
                      type="submit"
                      disabled={isTyping || !chatInput.trim()}
                      className="h-12 px-6 bg-gradient-primary hover:shadow-glow-modern transition-all duration-300 touch-manipulation"
                    >
                      {isTyping ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </form>
                  
                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[
                      "What is eInvoicing?",
                      "CFDI compliance",
                      "Peppol BIS 3.0",
                      "SAF-T requirements"
                    ].map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickAction(suggestion)}
                        disabled={isTyping}
                        className="text-xs bg-background/30 hover:bg-background/50 border border-border rounded-full px-3 py-1 text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Loading Skeleton */}
          {isLoading && (
            <Card className="bg-card/50 backdrop-blur border-border animate-fade-in">
              <CardContent className="p-6">
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-muted-foreground">Running validation...</span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </section>
  );
};

export default InvoiceLawSection;