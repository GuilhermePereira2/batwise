import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ShieldCheck } from "lucide-react";

interface PrivacySection {
    title: string;
    content: string[];
}

const Privacy = () => {
    const { t } = useTranslation();
    const sections = t('privacy.sections', { returnObjects: true }) as PrivacySection[];

    return (
        <div className="min-h-screen flex flex-col font-sans bg-background">
            <Navigation />

            <main className="flex-1 container mx-auto px-4 py-8 mt-16 max-w-4xl animate-fade-in">
                {/* Back Button */}
                <Button variant="ghost" asChild className="mb-6 pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
                    <Link to="/signup" className="flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> {t('privacy.back_button')}
                    </Link>
                </Button>

                <div className="space-y-6">
                    <div className="text-center space-y-2 mb-8">
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            {t('privacy.page_title')}
                        </h1>
                        <p className="text-muted-foreground">
                            {t('privacy.last_updated')}
                        </p>
                    </div>

                    {/* Dynamic Sections mapped from JSON */}
                    {Array.isArray(sections) && sections.map((section, index) => (
                        <Card key={index} className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <ShieldCheck className="w-5 h-5 text-accent" />
                                    {section.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-4">
                                {section.content.map((paragraph, pIndex) => (
                                    <p key={pIndex}>{paragraph}</p>
                                ))}
                            </CardContent>
                        </Card>
                    ))}

                    {/* Contact Section */}
                    <div className="pt-6 border-t border-border mt-8">
                        <h3 className="text-lg font-semibold mb-2 text-foreground">{t('privacy.contact.title')}</h3>
                        <p className="text-sm text-muted-foreground">
                            {t('privacy.contact.description')} <br />
                            <a href={`mailto:${t('privacy.contact.email')}`} className="text-accent hover:underline font-medium">
                                {t('privacy.contact.email')}
                            </a>
                        </p>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Privacy;