import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Shield, AlertCircle, Scale, Gavel } from "lucide-react";

const Terms = () => {
    // Dynamic date to keep it looking current
    const lastUpdated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="min-h-screen flex flex-col font-sans bg-background">
            <Navigation />

            <main className="flex-1 container mx-auto px-4 py-8 mt-16 max-w-4xl animate-fade-in">

                {/* Back Button */}
                <Button variant="ghost" asChild className="mb-6 pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
                    <Link to="/signup" className="flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Signup
                    </Link>
                </Button>

                <div className="space-y-6">
                    <div className="text-center space-y-2 mb-8">
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms and Conditions</h1>
                        <p className="text-muted-foreground">
                            Last updated: {lastUpdated}
                        </p>
                    </div>

                    {/* Section 1: Introduction */}
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-accent" />
                                1. Introduction
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-4">
                            <p>
                                Welcome to <strong>Watt Builder</strong> ("Company", "we", "our", "us"). These Terms and Conditions ("Terms", "Terms and Conditions") govern your relationship with our website and services (the "Service").
                            </p>
                            <p>
                                By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Section 2: Accounts */}
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-accent" />
                                2. Accounts & Security
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-4">
                            <p>
                                When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>You are responsible for safeguarding the password that you use to access the Service.</li>
                                <li>You agree not to disclose your password to any third party.</li>
                                <li>You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Section 3: Intellectual Property */}
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Scale className="w-5 h-5 text-accent" />
                                3. Intellectual Property
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-4">
                            <p>
                                The Service and its original content (excluding Content provided by users), features, and functionality are and will remain the exclusive property of <strong>Watt Builder</strong> and its licensors. The Service is protected by copyright, trademark, and other laws of both the country and foreign countries.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Section 4: Termination */}
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Gavel className="w-5 h-5 text-accent" />
                                4. Termination
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-4">
                            <p>
                                We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Section 5: Limitation of Liability */}
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-accent" />
                                5. Limitation of Liability
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-4">
                            <p>
                                In no event shall <strong>Watt Builder</strong>, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Contact Section */}
                    <div className="pt-6 border-t border-border mt-8">
                        <h3 className="text-lg font-semibold mb-2 text-foreground">Contact Us</h3>
                        <p className="text-sm text-muted-foreground">
                            If you have any questions about these Terms, please contact us at: <br />
                            <a href="mailto:general@watt-builder.com" className="text-accent hover:underline font-medium">
                                general@watt-builder.com
                            </a>
                        </p>
                    </div>

                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Terms;