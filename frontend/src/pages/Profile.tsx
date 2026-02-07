import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Coins, User, Building, Mail, Zap, Loader2, Calendar, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/config";

const Profile = () => {
    const { user, token, updateUser } = useAuth();
    const { toast } = useToast();
    const [isLoadingTrial, setIsLoadingTrial] = useState(false);

    if (!user) return <div>Loading...</div>;

    const getInitials = (name: string) => {
        if (!name) return "U";
        const parts = name.trim().split(" ");
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    // Verificar se o trial já foi ativado (campo trial_started_at existe)
    // Usamos (user as any) porque o tipo User no frontend pode ainda não ter sido atualizado com este campo
    const isTrialActive = (user as any).trial_started_at !== null && (user as any).trial_started_at !== undefined;

    // --- FUNÇÃO PARA ATIVAR O TRIAL ---
    const handleActivateTrial = async () => {
        setIsLoadingTrial(true);
        try {
            const url = getApiUrl("auth/activate-trial");

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Failed to activate trial");
            }

            // ATUALIZAÇÃO VISUAL IMEDIATA
            // O backend retorna o objeto User atualizado com os novos créditos.
            // Ao chamar updateUser, o Contexto global atualiza e reflete os créditos na Navbar e aqui.
            if (updateUser) {
                updateUser(data);
            }

            toast({
                title: "Trial Activated Successfully!",
                description: "You have received 1000 credits valid for 15 days.",
                className: "bg-green-600 text-white border-none"
            });

        } catch (error: any) {
            toast({
                title: "Activation Failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsLoadingTrial(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col font-sans bg-muted/10">
            <Navigation />

            <main className="flex-1 container max-w-5xl mx-auto p-6 mt-20 animate-fade-in">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>

                    {/* Badge de estado da conta */}
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${isTrialActive
                            ? "bg-orange-100 text-orange-700 border-orange-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}>
                        {isTrialActive ? "Premium Trial Active" : "Standard Plan"}
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">

                    {/* --- COLUNA ESQUERDA: RESUMO --- */}
                    <Card className="md:col-span-1 shadow-sm h-fit">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto mb-4 relative">
                                <Avatar className="h-28 w-28 border-4 border-background shadow-sm mx-auto">
                                    <AvatarFallback className="text-3xl bg-primary text-primary-foreground font-bold">
                                        {getInitials(user.name)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <CardTitle className="text-xl">{user.name}</CardTitle>
                            <CardDescription>{user.email}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center space-y-4 pt-4 border-t mt-4">
                            <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-xl">
                                <span className="text-sm text-muted-foreground uppercase font-semibold tracking-wider mb-1">Available Credits</span>
                                <div className="flex items-center gap-2 text-3xl font-bold text-foreground">
                                    <Coins className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                                    {user.credits}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* --- COLUNA DIREITA: AÇÕES E DETALHES --- */}
                    <div className="md:col-span-2 space-y-6">

                        {/* CARTÃO DE FREE TRIAL 
                            Só aparece se !isTrialActive
                        */}
                        {!isTrialActive && (
                            <Card className="bg-gradient-to-br from-orange-500 to-amber-600 text-white border-none shadow-md overflow-hidden relative">
                                {/* Efeito de fundo subtil */}
                                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>

                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-xl text-white">
                                        <Zap className="w-6 h-6 fill-white text-white" />
                                        Unlock 15-Day Free Trial
                                    </CardTitle>
                                    <CardDescription className="text-orange-100 text-base">
                                        Accelerate your battery design process with our premium features.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid sm:grid-cols-2 gap-4 mb-2">
                                        <div className="flex items-center gap-2 text-orange-50 text-sm">
                                            <CheckCircle2 className="w-4 h-4 text-white" /> 1000 Computation Credits
                                        </div>
                                        <div className="flex items-center gap-2 text-orange-50 text-sm">
                                            <CheckCircle2 className="w-4 h-4 text-white" /> Advanced Cell Database
                                        </div>
                                        <div className="flex items-center gap-2 text-orange-50 text-sm">
                                            <CheckCircle2 className="w-4 h-4 text-white" /> No Credit Card Required
                                        </div>
                                        <div className="flex items-center gap-2 text-orange-50 text-sm">
                                            <CheckCircle2 className="w-4 h-4 text-white" /> Instant Activation
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        onClick={handleActivateTrial}
                                        disabled={isLoadingTrial}
                                        className="bg-white text-orange-600 hover:bg-orange-50 hover:text-orange-700 font-bold border-none w-full sm:w-auto shadow-sm"
                                    >
                                        {isLoadingTrial ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Activating...</>
                                        ) : (
                                            "Start Free Trial Now"
                                        )}
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}

                        {/* --- DETALHES DA CONTA --- */}
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <User className="w-5 h-5 text-muted-foreground" />
                                    Account Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid gap-1.5">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Full Name</label>
                                    <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium text-foreground">{user.name}</span>
                                    </div>
                                </div>

                                <div className="grid gap-1.5">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Email Address</label>
                                    <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium text-foreground">{user.email}</span>
                                    </div>
                                </div>

                                <div className="grid gap-1.5">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Company</label>
                                    <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border">
                                        <Building className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium text-foreground">
                                            {(user as any).company || "Not provided"}
                                        </span>
                                    </div>
                                </div>

                                {(user as any).created_at && (
                                    <div className="grid gap-1.5">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Member Since</label>
                                        <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border">
                                            <Calendar className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium text-foreground">
                                                {new Date((user as any).created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Profile;