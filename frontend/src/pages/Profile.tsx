import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Coins, User, Building, Mail } from "lucide-react";

const Profile = () => {
    const { user } = useAuth();

    if (!user) return <div>Loading...</div>;

    const getInitials = (name: string) => {
        if (!name) return "U";
        const parts = name.trim().split(" ");
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Navigation />

            <main className="flex-1 container max-w-4xl mx-auto p-6 mt-20">
                <h1 className="text-3xl font-bold mb-8">My Profile</h1>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Cartão Esquerdo - Info Básica */}
                    <Card className="md:col-span-1">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4">
                                <Avatar className="h-24 w-24">
                                    <AvatarFallback className="text-2xl bg-accent text-accent-foreground font-bold">
                                        {getInitials(user.name)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <CardTitle>{user.name}</CardTitle>
                            <CardDescription>{user.email}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-medium">
                                <Coins className="w-5 h-5" />
                                {user.credits} Credits
                            </div>
                        </CardContent>
                    </Card>

                    {/* Cartão Direito - Detalhes */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Account Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md border">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    {user.name}
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md border">
                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                    {user.email}
                                </div>
                            </div>

                            {/* Assumindo que guardaste a empresa no login, senão podes esconder */}
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Company</label>
                                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md border">
                                    <Building className="w-4 h-4 text-muted-foreground" />
                                    {/* Se o backend enviar company, usa user.company, senão "Not provided" */}
                                    {(user as any).company || "Not provided"}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Profile;