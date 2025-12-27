import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, MapPin, Loader2 } from "lucide-react"; // Adicionei Loader2
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { getApiUrl } from "@/lib/config"; // <--- IMPORTANTE: Usa o helper que criámos
import { useSearchParams } from "react-router-dom"; // Adiciona esta linha
import { useState, useEffect } from "react"; // Garante que o useEffect está importado

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  message: z.string().trim().min(1, "Message is required").max(1000),
});

const Contact = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const prefilledMessage = searchParams.get("message");
    if (prefilledMessage) {
      setFormData((prev) => ({
        ...prev,
        message: prefilledMessage,
      }));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 1. Validação local
      contactSchema.parse(formData);
      setIsSubmitting(true);

      // 2. Definir URL do Backend
      const url = getApiUrl("send-contact-email");

      // 3. Enviar para o Python
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to send message via server");
      }

      // 4. Sucesso
      toast({
        title: "Message sent!",
        description: "We have received your email and will reply shortly.",
        variant: "default", // Verde/Positivo
      });

      setFormData({ name: "", email: "", message: "" });

    } catch (error) {
      // Tratamento de erros
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        console.error("Submission error:", error);
        toast({
          title: "Error sending message",
          description: "Something went wrong. Please try again later or email us directly.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-muted/30 to-background">
        <div className="container px-4 mx-auto max-w-6xl text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 animate-fade-in">
            Get in Touch
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
            Need help or want to professionalize your project? Contact us.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 pb-24 bg-background">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="shadow-soft animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <MessageSquare className="w-6 h-6 text-accent" />
                  Send us a message
                </CardTitle>
                <CardDescription>
                  Fill out the form and we'll get back to you as soon as possible
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us about your project or question..."
                      rows={6}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                      </>
                    ) : (
                      "Send Message"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info (Mantém-se igual ao teu código original) */}
            <div className="space-y-8 animate-slide-up" style={{ animationDelay: "100ms" }}>
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  Let's build something great together
                </h2>
                <p className="text-muted-foreground text-lg">
                  Whether you're a DIY enthusiast or a business looking for professional battery design solutions, we're here to help.
                </p>
              </div>

              <div className="space-y-6">
                <Card className="border-l-4 border-l-accent">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-1">Email</h3>
                        <p className="text-muted-foreground">general@watt-builder.com</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-accent">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-1">Location</h3>
                        <p className="text-muted-foreground">
                          Rua Alves Redol, 9<br />
                          1000-029 Lisboa, Portugal
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;