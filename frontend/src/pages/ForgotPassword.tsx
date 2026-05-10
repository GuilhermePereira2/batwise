import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { KeyRound, Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/config";

const ForgotPassword = () => {
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const { toast } = useToast();

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const url = getApiUrl("auth/forgot-password");

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) throw new Error("Request failed");

            setIsSubmitted(true);
            toast({
                title: t('forgot.toasts.successTitle'),
                description: t('forgot.toasts.successDesc'),
            });

        } catch (error) {
            toast({
                title: t('forgot.toasts.errorTitle'),
                description: t('forgot.toasts.errorDesc'),
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Navigation />

            <main className="flex-1 flex items-center justify-center p-4 mt-16 bg-gradient-to-br from-background via-muted/30 to-background">
                <div className="w-full max-w-md animate-fade-in">

                    <Button variant="ghost" asChild className="mb-4 pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
                        <Link to="/login" className="flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4" /> {t('forgot.backToLogin')}
                        </Link>
                    </Button>

                    <Card className="border-border shadow-lg">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                <KeyRound className="w-6 h-6 text-accent" /> {t('forgot.title')}
                            </CardTitle>
                            <CardDescription>
                                {isSubmitted
                                    ? t('forgot.descSubmitted')
                                    : t('forgot.descDefault')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isSubmitted ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 animate-in fade-in zoom-in duration-300">
                                    <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            {t('forgot.sentLinkTo')} <strong>{email}</strong>.
                                        </p>
                                        <Button variant="outline" onClick={() => setIsSubmitted(false)} className="mt-4">
                                            {t('forgot.tryAnotherEmail')}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleReset} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">{t('forgot.emailLabel')}</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder={t('forgot.emailPlaceholder')}
                                                className="pl-9"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('forgot.sending')}
                                            </>
                                        ) : (
                                            t('forgot.sendButton')
                                        )}
                                    </Button>
                                </form>
                            )}
                        </CardContent>
                        {!isSubmitted && (
                            <CardFooter className="flex justify-center border-t bg-muted/20 p-6">
                                <div className="text-sm text-muted-foreground">
                                    {t('forgot.rememberPassword')}{" "}
                                    <Link to="/login" className="text-accent hover:underline font-medium">
                                        {t('forgot.signIn')}
                                    </Link>
                                </div>
                            </CardFooter>
                        )}
                    </Card>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default ForgotPassword;