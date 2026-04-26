import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, ArrowDown, Home, Database, Cpu, LineChart, CheckCircle2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/config";
import { useTranslation, Trans } from "react-i18next";

const Simulator = () => {
    const { t } = useTranslation();
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

            // O conteúdo da mensagem em si pode ficar na língua principal da vossa equipa (PT/EN)
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
                title: t("simulator.waitlist.toast_error_title"),
                description: t("simulator.waitlist.toast_error_desc"),
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
                        {t("simulator.waitlist.badge")}
                    </div>

                    <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
                        {t("simulator.waitlist.title_prefix")} <br />
                        <span className="text-[#FF6600]">{t("simulator.waitlist.title_highlight")}</span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                        <Trans
                            i18nKey="simulator.waitlist.subtitle"
                            components={{ 1: <strong /> }}
                        />
                    </p>

                    <div className="max-w-md mx-auto">
                        {isSubmitted ? (
                            <div className="flex items-center justify-center gap-3 p-6 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-xl border border-green-200 dark:border-green-900 animate-slide-up">
                                <CheckCircle2 className="w-6 h-6" />
                                <span className="font-medium text-lg">{t("simulator.waitlist.success_msg")}</span>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-grow">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                    <Input
                                        type="email"
                                        placeholder={t("simulator.waitlist.placeholder")}
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
                                    {isLoading ? t("simulator.waitlist.btn_loading") : t("simulator.waitlist.btn_submit")}
                                </Button>
                            </form>
                        )}
                        <p className="text-xs text-muted-foreground mt-4">{t("simulator.waitlist.spam_notice")}</p>
                    </div>
                </section>

                {/* How it Works - Flowchart Section */}
                <section className="container px-4 mx-auto max-w-6xl">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                            {t("simulator.flowchart.title")}
                        </h2>
                        <p className="text-muted-foreground">
                            {t("simulator.flowchart.subtitle")}
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
                        {/* Step 1 */}
                        <div className="flex-1 w-full md:w-auto bg-card border rounded-xl p-6 text-center shadow-sm relative">
                            <div className="mx-auto w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4 text-accent">
                                <Home className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold mb-2">{t("simulator.flowchart.step1_title")}</h3>
                            <p className="text-sm text-muted-foreground">
                                {t("simulator.flowchart.step1_desc")}
                            </p>
                        </div>

                        <ArrowDown className="md:hidden text-muted-foreground w-6 h-6" />
                        <ArrowRight className="hidden md:block text-muted-foreground w-8 h-8 flex-shrink-0" />

                        {/* Step 2 */}
                        <div className="flex-1 w-full md:w-auto bg-card border rounded-xl p-6 text-center shadow-sm relative">
                            <div className="mx-auto w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4 text-accent">
                                <Database className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold mb-2">{t("simulator.flowchart.step2_title")}</h3>
                            <p className="text-sm text-muted-foreground">
                                {t("simulator.flowchart.step2_desc")}
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
                            <h3 className="font-bold mb-2">{t("simulator.flowchart.step3_title")}</h3>
                            <p className="text-sm text-muted-foreground">
                                {t("simulator.flowchart.step3_desc")}
                            </p>
                        </div>

                        <ArrowDown className="md:hidden text-muted-foreground w-6 h-6" />
                        <ArrowRight className="hidden md:block text-muted-foreground w-8 h-8 flex-shrink-0" />

                        {/* Step 4 */}
                        <div className="flex-1 w-full md:w-auto bg-card border rounded-xl p-6 text-center shadow-sm relative">
                            <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4 text-green-600">
                                <LineChart className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold mb-2">{t("simulator.flowchart.step4_title")}</h3>
                            <p className="text-sm text-muted-foreground">
                                {t("simulator.flowchart.step4_desc")}
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