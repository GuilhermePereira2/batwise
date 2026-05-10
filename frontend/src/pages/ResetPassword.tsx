import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyRound, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/config";

const ResetPassword = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Obter dados da URL
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    useEffect(() => {
        if (!token || !email) {
            toast({
                title: t('resetPassword.toasts.invalidLinkTitle'),
                description: t('resetPassword.toasts.invalidLinkDesc'),
                variant: "destructive"
            });
            navigate("/login");
        }
    }, [token, email, navigate, toast, t]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast({
                title: t('resetPassword.toasts.errorTitle'),
                description: t('resetPassword.toasts.passwordsMismatch'),
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);

        try {
            const url = getApiUrl("auth/reset-password");
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, token, new_password: password }),
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.detail || t('resetPassword.toasts.resetFailed'));

            toast({
                title: t('resetPassword.toasts.successTitle'),
                description: t('resetPassword.toasts.successDesc'),
                className: "bg-green-600 text-white border-none"
            });

            navigate("/login");

        } catch (error: any) {
            toast({
                title: t('resetPassword.toasts.errorTitle'),
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Navigation />
            <main className="flex-1 flex items-center justify-center p-4 mt-16">
                <Card className="w-full max-w-md shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <KeyRound className="w-6 h-6 text-accent" /> {t('resetPassword.title')}
                        </CardTitle>
                        <CardDescription>{t('resetPassword.description')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleReset} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="pass">{t('resetPassword.newPasswordLabel')}</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="pass"
                                        type={showPassword ? "text" : "password"}
                                        className="pl-9 pr-10"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required minLength={8}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground">
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="conf">{t('resetPassword.confirmPasswordLabel')}</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="conf"
                                        type={showPassword ? "text" : "password"}
                                        className="pl-9"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required minLength={8}
                                    />
                                </div>
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('resetPassword.updating')}</> : t('resetPassword.submitButton')}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>
            <Footer />
        </div>
    );
};

export default ResetPassword;