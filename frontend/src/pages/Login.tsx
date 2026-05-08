import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { LogIn, Mail, Lock, Loader2, ArrowLeft, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/config";
import { resendVerificationEmail } from "@/lib/auth-api";

const Login = () => {
    // Estados do Formulário
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    // Novos Estados para UI
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockActive, setCapsLockActive] = useState(false);
    
    // Estados para verificação de email
    const [showResendVerification, setShowResendVerification] = useState(false);
    const [isResendingEmail, setIsResendingEmail] = useState(false);

    const { toast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const googleButtonRef = useRef<HTMLDivElement | null>(null);
    const redirectTo = new URLSearchParams(location.search).get("redirect") || "/diy";

    useEffect(() => {
        const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!googleClientId || !googleButtonRef.current) return;

        const initializeGoogle = () => {
            const google = (window as any).google;
            if (!google?.accounts?.id || !googleButtonRef.current) return;

            google.accounts.id.initialize({
                client_id: googleClientId,
                callback: handleGoogleCredential,
            });
            google.accounts.id.renderButton(googleButtonRef.current, {
                theme: "outline",
                size: "large",
                width: googleButtonRef.current.offsetWidth || 360,
                text: "signin_with",
            });
        };

        if ((window as any).google?.accounts?.id) {
            initializeGoogle();
            return;
        }

        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = initializeGoogle;
        document.body.appendChild(script);
    }, []);

    // Função para detetar Caps Lock
    const checkCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const capsLockOn: boolean = event.getModifierState('CapsLock');
        setCapsLockActive(capsLockOn);
    };

    // Função para reenviar email de verificação
    const handleResendVerification = async () => {
        if (!email) {
            toast({
                title: "Email required",
                description: "Please enter your email address.",
                variant: "destructive"
            });
            return;
        }

        setIsResendingEmail(true);
        try {
            await resendVerificationEmail(email);

            toast({
                title: "Verification email sent!",
                description: "Please check your inbox and click the verification link.",
            });

            setShowResendVerification(false);

        } catch (error: any) {
            toast({
                title: "Resend failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsResendingEmail(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const url = getApiUrl("auth/login");
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("Invalid email or password.");
                }
                if (response.status === 403) {
                    // Email não verificado
                    setShowResendVerification(true);
                    throw new Error("Email not verified. Please check your inbox or resend the verification email.");
                }
                throw new Error("Something went wrong. Please try again.");
            }

            const data = await response.json();

            login(data.access_token, {
                id: email, // Use email as unique ID
                email: email,
                name: data.user_name,
                credits: data.credits
            });

            toast({
                title: "Welcome back!",
                description: "You have successfully logged in.",
            });

            navigate(redirectTo);

        } catch (error: any) {
            toast({
                title: "Login Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleCredential = async (response: any) => {
        if (!response?.credential) return;
        setIsGoogleLoading(true);

        try {
            const res = await fetch(getApiUrl("auth/google-login"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential: response.credential }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || "Google login failed.");
            }

            const data = await res.json();
            login(data.access_token, {
                id: data.email || data.user_name,
                email: data.email || "",
                name: data.user_name,
                credits: data.credits,
                trial_started_at: data.trial_started_at,
                admin: data.admin,
            });

            toast({
                title: "Welcome!",
                description: "You have successfully logged in with Google.",
            });
            navigate(redirectTo);
        } catch (error: any) {
            toast({
                title: "Google Login Failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Navigation />

            <main className="flex-1 flex items-center justify-center p-4 mt-16 bg-gradient-to-br from-background via-muted/30 to-background">
                <div className="w-full max-w-md animate-fade-in">

                    <Button variant="ghost" asChild className="mb-4 pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
                        <Link to="/" className="flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4" /> Back to Home
                        </Link>
                    </Button>

                    <Card className="border-border shadow-lg">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                <LogIn className="w-6 h-6 text-accent" /> Log In
                            </CardTitle>
                            <CardDescription>
                                Enter your email and password to access your account.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="name@example.com"
                                            className="pl-9"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password">Password</Label>
                                        <Link
                                            to="/forgot-password"
                                            className="text-xs text-muted-foreground hover:text-accent hover:underline"
                                        >
                                            Forgot password?
                                        </Link>
                                    </div>

                                    {/* Campo Password Modificado */}
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

                                        <Input
                                            id="password"
                                            // Lógica para mostrar/esconder texto
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            // Adicionado pr-10 para o texto não ficar atrás do olho
                                            className="pl-9 pr-10"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            // Eventos do Caps Lock
                                            onKeyDown={checkCapsLock}
                                            onKeyUp={checkCapsLock}
                                            onClick={checkCapsLock} // Verifica se clicar já com ele ligado
                                            onBlur={() => setCapsLockActive(false)} // Esconde aviso se sair do campo
                                            required
                                        />

                                        {/* Botão do Olho */}
                                        <button
                                            type="button" // Importante para não submeter o form
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus:outline-none"
                                            tabIndex={-1} // Opcional: para não focar no tab
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Aviso de Caps Lock */}
                                    {capsLockActive && (
                                        <div className="flex items-center text-xs text-yellow-600 mt-1 animate-in fade-in slide-in-from-top-1">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            Caps Lock is on
                                        </div>
                                    )}
                                </div>

                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in...
                                        </>
                                    ) : (
                                        "Sign In"
                                    )}
                                </Button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-border" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-card px-2 text-muted-foreground">or</span>
                                    </div>
                                </div>

                                <div className="min-h-11 w-full">
                                    {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                                        <div ref={googleButtonRef} className={isGoogleLoading ? "pointer-events-none opacity-60" : ""} />
                                    ) : (
                                        <Button type="button" variant="outline" className="w-full" disabled>
                                            Google login not configured
                                        </Button>
                                    )}
                                </div>

                                {/* Botão para Reenviar Email de Verificação */}
                                {showResendVerification && (
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        className="w-full"
                                        onClick={handleResendVerification}
                                        disabled={isResendingEmail}
                                    >
                                        {isResendingEmail ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resending...
                                            </>
                                        ) : (
                                            <>
                                                <Mail className="mr-2 h-4 w-4" /> Resend Verification Email
                                            </>
                                        )}
                                    </Button>
                                )}
                            </form>
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-4 border-t bg-muted/20 p-6">
                            <div className="text-center text-sm text-muted-foreground">
                                Don't have an account?{" "}
                                <Link to="/signup" className="text-accent hover:underline font-medium">
                                    Sign up
                                </Link>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Login;
