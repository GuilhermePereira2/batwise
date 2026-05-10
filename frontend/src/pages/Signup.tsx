import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { UserPlus, Mail, Lock, User, Loader2, ArrowLeft, Eye, EyeOff, AlertTriangle, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/config";
import { resendVerificationEmail } from "@/lib/auth-api";

const Signup = () => {
    const { t } = useTranslation();

    const [name, setName] = useState("");
    const [company, setCompany] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [acceptTerms, setAcceptTerms] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [capsLockActive, setCapsLockActive] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const [emailExists, setEmailExists] = useState(false);
    const [isResendingEmail, setIsResendingEmail] = useState(false);

    const { toast } = useToast();
    const navigate = useNavigate();

    const checkCapsLock = (event: React.KeyboardEvent | React.MouseEvent | React.FocusEvent) => {
        const evt = event as any;
        if (typeof evt.getModifierState !== "function") return;

        const currentState = evt.getModifierState("CapsLock");

        if (evt.nativeEvent instanceof KeyboardEvent) {
            if (evt.key === "CapsLock") {
                if (evt.type === 'keydown') {
                    setCapsLockActive(!currentState);
                } else {
                    setCapsLockActive(currentState);
                }
            } else {
                setCapsLockActive(currentState);
            }
        } else {
            setCapsLockActive(currentState);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setEmailExists(false);

        if (!acceptTerms) {
            toast({
                title: t('signup.toasts.termsRequired'),
                description: t('signup.toasts.termsRequiredDesc'),
                variant: "destructive"
            });
            setIsLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            toast({
                title: t('signup.toasts.passwordsMismatch'),
                description: t('signup.toasts.passwordsMismatchDesc'),
                variant: "destructive"
            });
            setIsLoading(false);
            return;
        }

        try {
            const url = getApiUrl("auth/signup");

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    full_name: name,
                    email: email,
                    password: password,
                    company: company
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorDetail = errorData.detail || "Registration failed";

                if (errorDetail.toLowerCase().includes("already registered") ||
                    errorDetail.toLowerCase().includes("already exists") ||
                    errorDetail.toLowerCase().includes("email already")) {
                    setEmailExists(true);
                    toast({
                        title: t('signup.toasts.accountExists'),
                        description: t('signup.toasts.accountExistsDesc', { email }),
                        variant: "destructive"
                    });
                } else {
                    throw new Error(errorDetail);
                }
            } else {
                setIsSubmitted(true);
                toast({
                    title: t('signup.toasts.createdTitle'),
                    description: t('signup.toasts.createdDesc'),
                });
            }

        } catch (error: any) {
            console.error("Signup error:", error);
            toast({
                title: t('signup.toasts.errorTitle'),
                description: error.message || t('signup.toasts.errorDesc'),
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (!email) {
            toast({
                title: t('signup.toasts.emailRequired'),
                description: t('signup.toasts.emailRequiredDesc'),
                variant: "destructive"
            });
            return;
        }

        setIsResendingEmail(true);
        try {
            await resendVerificationEmail(email);

            toast({
                title: t('signup.toasts.resendSuccess'),
                description: t('signup.toasts.resendSuccessDesc'),
            });

        } catch (error: any) {
            toast({
                title: t('signup.toasts.resendFailed'),
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsResendingEmail(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Navigation />

            <main className="flex-1 flex items-center justify-center p-4 mt-16 bg-gradient-to-br from-background via-muted/30 to-background">
                <div className="w-full max-w-md animate-fade-in">

                    {!isSubmitted && (
                        <Button variant="ghost" asChild className="mb-4 pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
                            <Link to="/" className="flex items-center gap-2">
                                <ArrowLeft className="w-4 h-4" /> {t('signup.backToHome')}
                            </Link>
                        </Button>
                    )}

                    <Card className="border-border shadow-lg">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                {isSubmitted ? (
                                    <><Mail className="w-6 h-6 text-accent" /> {t('signup.titleVerify')}</>
                                ) : (
                                    <><UserPlus className="w-6 h-6 text-accent" /> {t('signup.titleCreate')}</>
                                )}
                            </CardTitle>
                            <CardDescription>
                                {isSubmitted
                                    ? t('signup.descVerify')
                                    : t('signup.descCreate')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isSubmitted ? (
                                <div className="text-center py-6 space-y-4 animate-in fade-in zoom-in duration-300">
                                    <div className="h-20 w-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                                        <Mail className="h-10 w-10 text-accent animate-pulse" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            {t('signup.verifySentTo')} <span className="font-semibold text-foreground">{email}</span>.
                                        </p>
                                        <p className="text-xs text-muted-foreground italic">
                                            {t('signup.checkSpam')}
                                        </p>
                                    </div>
                                    <Button asChild className="w-full mt-4">
                                        <Link to="/login">{t('signup.goToLogin')}</Link>
                                    </Button>
                                </div>
                            ) : (
                                <form onSubmit={handleSignup} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">{t('signup.nameLabel')}</Label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="name"
                                                type="text"
                                                placeholder={t('signup.namePlaceholder')}
                                                className="pl-9"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="company">{t('signup.companyLabel')}</Label>
                                        <div className="relative">
                                            <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="company"
                                                type="text"
                                                placeholder={t('signup.companyPlaceholder')}
                                                className="pl-9"
                                                value={company}
                                                onChange={(e) => setCompany(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">{t('signup.emailLabel')}</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder={t('signup.emailPlaceholder')}
                                                className={`pl-9 ${emailExists ? 'border-destructive' : ''}`}
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    setEmailExists(false);
                                                }}
                                                required
                                            />
                                        </div>

                                        {emailExists && (
                                            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                                                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                                <div className="flex-1 text-sm">
                                                    <p className="text-destructive font-medium">{t('signup.emailExists')}</p>
                                                    <p className="text-destructive/80 text-xs mt-1">
                                                        {t('signup.emailRegistered')}{" "}
                                                        <Link to="/login" className="underline font-medium hover:text-destructive">
                                                            {t('signup.signInInstead')}
                                                        </Link>
                                                        {" "}{t('signup.orDifferentEmail')}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password">{t('signup.passwordLabel')}</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder={t('signup.passwordPlaceholder')}
                                                className="pl-9 pr-10"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                onKeyDown={checkCapsLock}
                                                onKeyUp={checkCapsLock}
                                                onClick={checkCapsLock}
                                                onFocus={checkCapsLock}
                                                onBlur={() => setCapsLockActive(false)}
                                                required
                                                minLength={8}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus:outline-none"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {capsLockActive && (
                                            <div className="flex items-center text-xs text-yellow-600 mt-1 animate-in fade-in slide-in-from-top-1">
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                {t('signup.capsLock')}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">{t('signup.confirmPasswordLabel')}</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder={t('signup.confirmPasswordPlaceholder')}
                                                className="pl-9 pr-10"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                onKeyDown={checkCapsLock}
                                                onKeyUp={checkCapsLock}
                                                onClick={checkCapsLock}
                                                onFocus={checkCapsLock}
                                                onBlur={() => setCapsLockActive(false)}
                                                required
                                                minLength={8}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus:outline-none"
                                                tabIndex={-1}
                                            >
                                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {capsLockActive && (
                                            <div className="flex items-center text-xs text-yellow-600 mt-1 animate-in fade-in slide-in-from-top-1">
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                {t('signup.capsLock')}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center space-x-2 pt-2">
                                        <Checkbox
                                            id="terms"
                                            checked={acceptTerms}
                                            onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                                        />
                                        <Label
                                            htmlFor="terms"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            {t('signup.termsAccept')}{" "}
                                            <Link to="/Terms" className="text-accent hover:underline" target="_blank">
                                                {t('signup.termsLink')}
                                            </Link>
                                            {" "}{t('signup.termsAnd')}{" "}
                                            <Link to="/Privacy" className="text-accent hover:underline" target="_blank">
                                                {t('signup.privacyLink')}
                                            </Link>
                                        </Label>
                                    </div>

                                    <Button type="submit" className="w-full mt-2" disabled={isLoading}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('signup.buttonLoading')}
                                            </>
                                        ) : (
                                            t('signup.buttonSubmit')
                                        )}
                                    </Button>
                                </form>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-4 border-t bg-muted/20 p-6 text-center">
                            <div className="text-sm text-muted-foreground">
                                {isSubmitted ? (
                                    <Button
                                        type="button"
                                        variant="link"
                                        onClick={handleResendVerification}
                                        disabled={isResendingEmail}
                                        className="h-auto p-0 text-accent font-medium cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        {isResendingEmail ? t('signup.resendLoading') : t('signup.resendButton')}
                                    </Button>
                                ) : (
                                    <>
                                        {t('signup.hasAccount')}{" "}
                                        <Link to="/login" className="text-accent hover:underline font-medium">
                                            {t('signup.signInLink')}
                                        </Link>
                                    </>
                                )}
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Signup;