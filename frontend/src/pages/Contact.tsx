import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { getApiUrl } from "@/lib/config";
import { useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const Contact = () => {
  const { t } = useTranslation();
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

    // Movido para dentro para usar as traduções (t)
    const contactSchema = z.object({
      name: z.string().trim().min(1, t('contact.validation.nameReq')).max(100),
      email: z.string().trim().email(t('contact.validation.emailInv')).max(255),
      message: z.string().trim().min(1, t('contact.validation.msgReq')).max(1000),
    });

    try {
      contactSchema.parse(formData);
      setIsSubmitting(true);

      const url = getApiUrl("send-contact-email");

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

      toast({
        title: t('contact.toasts.successTitle'),
        description: t('contact.toasts.successDesc'),
        variant: "default",
      });

      setFormData({ name: "", email: "", message: "" });

    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t('contact.toasts.valError'),
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        console.error("Submission error:", error);
        toast({
          title: t('contact.toasts.errorTitle'),
          description: t('contact.toasts.errorDesc'),
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
            {t('contact.heroTitle')}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
            {t('contact.heroSubtitle')}
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
                  {t('contact.formTitle')}
                </CardTitle>
                <CardDescription>
                  {t('contact.formDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('contact.nameLabel')}</Label>
                    <Input
                      id="name"
                      placeholder={t('contact.namePlaceholder')}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t('contact.emailLabel')}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('contact.emailPlaceholder')}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">{t('contact.messageLabel')}</Label>
                    <Textarea
                      id="message"
                      placeholder={t('contact.messagePlaceholder')}
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
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('contact.sending')}
                      </>
                    ) : (
                      t('contact.sendButton')
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="space-y-8 animate-slide-up" style={{ animationDelay: "100ms" }}>
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  {t('contact.infoTitle')}
                </h2>
                <p className="text-muted-foreground text-lg">
                  {t('contact.infoDesc')}
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
                        <h3 className="font-semibold text-foreground mb-1">{t('contact.emailField')}</h3>
                        <p className="text-muted-foreground">general@watt-builder.com</p>
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