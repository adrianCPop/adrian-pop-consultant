import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              What People Say
            </h2>
            <p className="text-lg text-muted-foreground">
              Feedback from colleagues and clients who have worked with me directly.
            </p>
          </div>

          {/* Testimonial Card */}
          <Card className="bg-card/50 backdrop-blur border-border shadow-card">
            <CardContent className="p-8 lg:p-12">
              <div className="flex flex-col items-center text-center">
                {/* Quote Icon */}
                <div className="w-12 h-12 bg-gradient-primary rounded-full mb-6 flex items-center justify-center shadow-glow">
                  <Quote className="w-6 h-6 text-primary-foreground" />
                </div>

                {/* Testimonial Text */}
                <blockquote className="text-lg lg:text-xl text-foreground leading-relaxed mb-8 italic">
                  "Adrian came on board to help us manage our development process in our distributed team working only remotely and geographically dispersed. Adrian has brought structure, method and overview to our backlog and his management of the team has been invaluable. Adrian is experienced, competent and pleasant and his calm and efficient management of the board, the team and the sprints has been impressive. If you get a chance to work with Adrian, you should grab it!"
                </blockquote>

                {/* Attribution */}
                <div className="text-center">
                  <div className="font-semibold text-foreground text-lg mb-1">
                    Lars Kjærsgaard
                  </div>
                  <div className="text-muted-foreground">
                    Chief Architect @ hopp tech ltd
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    (Managed Adrian directly, August 2024)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;