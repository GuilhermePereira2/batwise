import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Assumindo que tens um componente Input do shadcn/ui
import { ArrowRight, ArrowDown, Home, Database, Cpu, LineChart, CheckCircle2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/config";

const Simulator = () => {
    const { toast } = useToast();
    const [email, setEmail] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);

        try {
            const url = getApiUrl("send-contact-email");

            // Formatamos o payload para ser aceite pelo endpoint de contacto existente
            const payload = {
                name: "WAITINGLIST Contact",
                email: email,
                message: `Novo interesse na Waitlist do Simulador. Email: ${email}`
            };

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error("Failed to register on waitlist");
            }

            setIsSubmitted(true);
            setEmail("");

        } catch (error) {
            console.error("Waitlist submission error:", error);
            toast({
                title: "Error joining waitlist",
                description: "Something went wrong. Please try again later.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navigation />

            <main className="flex-grow pt-24 pb-16">
                {/* Waitlist Hero Section */}
                <section className="container px-4 mx-auto max-w-4xl text-center mb-20 animate-fade-in">
                    <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-[#FF6600]/10 text-[#FF6600] text-sm font-medium">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6600] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF6600]"></span>
                        </span>
                        Launching Soon
                    </div>

                    <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
                        Smart Battery Sizing, <br />
                        <span className="text-[#FF6600]">Simplified.</span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                        We're putting the finishing touches on our B2C simulator. Enter your email to get <strong>free early access</strong> and discover the exact return on investment for your home battery.
                    </p>

                    <div className="max-w-md mx-auto">
                        {isSubmitted ? (
                            <div className="flex items-center justify-center gap-3 p-6 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-xl border border-green-200 dark:border-green-900 animate-slide-up">
                                <CheckCircle2 className="w-6 h-6" />
                                <span className="font-medium text-lg">You're on the list! We'll be in touch.</span>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-grow">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                    <Input
                                        type="email"
                                        placeholder="Enter your email address"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10 h-12 text-base"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    size="lg"
                                    disabled={isLoading}
                                    className="h-12 px-8 bg-[#FF6600] hover:bg-[#FF6600]/90 text-white font-medium"
                                >
                                    {isLoading ? "Joining..." : "Get Free Access"}
                                </Button>
                            </form>
                        )}
                        <p className="text-xs text-muted-foreground mt-4">No spam. Unsubscribe at any time.</p>
                    </div>
                </section>

                {/* How it Works - Flowchart Section */}
                <section className="container px-4 mx-auto max-w-6xl">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                            How do we calculate your perfect battery?
                        </h2>
                        <p className="text-muted-foreground">
                            No guesswork. Complete transparency. Here is how our algorithm works:
                        </p>
                    </div>

                    {/* Desktop Flowchart (Horizontal) / Mobile (Vertical) */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">

                        {/* Step 1 */}
                        <div className="flex-1 w-full md:w-auto bg-card border rounded-xl p-6 text-center shadow-sm relative">
                            <div className="mx-auto w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4 text-accent">
                                <Home className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold mb-2">1. Your Inputs</h3>
                            <p className="text-sm text-muted-foreground">
                                You provide your monthly energy consumption, solar production (if any), and current electricity tariff.
                            </p>
                        </div>

                        <ArrowDown className="md:hidden text-muted-foreground w-6 h-6" />
                        <ArrowRight className="hidden md:block text-muted-foreground w-8 h-8 flex-shrink-0" />

                        {/* Step 2 */}
                        <div className="flex-1 w-full md:w-auto bg-card border rounded-xl p-6 text-center shadow-sm relative">
                            <div className="mx-auto w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4 text-accent">
                                <Database className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold mb-2">2. Hardware Match</h3>
                            <p className="text-sm text-muted-foreground">
                                We cross-reference your data with our proprietary database of the top 20 batteries and inverters on the market.
                            </p>
                        </div>

                        <ArrowDown className="md:hidden text-muted-foreground w-6 h-6" />
                        <ArrowRight className="hidden md:block text-muted-foreground w-8 h-8 flex-shrink-0" />

                        {/* Step 3 */}
                        <div className="flex-1 w-full md:w-auto bg-card border border-[#FF6600]/30 rounded-xl p-6 text-center shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-[#FF6600]"></div>
                            <div className="mx-auto w-12 h-12 bg-[#FF6600]/10 rounded-full flex items-center justify-center mb-4 text-[#FF6600]">
                                <Cpu className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold mb-2">3. Optimization Engine</h3>
                            <p className="text-sm text-muted-foreground">
                                Our algorithm simulates thousands of charge/discharge cycles to find the exact setup that maximizes your savings.
                            </p>
                        </div>

                        <ArrowDown className="md:hidden text-muted-foreground w-6 h-6" />
                        <ArrowRight className="hidden md:block text-muted-foreground w-8 h-8 flex-shrink-0" />

                        {/* Step 4 */}
                        <div className="flex-1 w-full md:w-auto bg-card border rounded-xl p-6 text-center shadow-sm relative">
                            <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4 text-green-600">
                                <LineChart className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold mb-2">4. Your ROI</h3>
                            <p className="text-sm text-muted-foreground">
                                You get a clear, unbiased report showing exactly which battery to buy and when it will pay for itself.
                            </p>
                        </div>

                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
};

export default Simulator;