import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { LogIn, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Simulação de login (Substituir pela chamada real ao Supabase/Backend depois)
            await new Promise(resolve => setTimeout(resolve, 1500));

            console.log("Login attempt:", { email, password });

            toast({
                title: "Welcome back!",
                description: "You have successfully logged in.",
            });

            // Redirecionar para a ferramenta após login
            navigate("/diy");

        } catch (error) {
            toast({
                title: "Login Failed",
                description: "Please check your credentials and try again.",
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
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            className="pl-9"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
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