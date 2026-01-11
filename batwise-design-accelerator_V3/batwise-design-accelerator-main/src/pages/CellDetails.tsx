// src/pages/CellDetails.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Battery, Zap, Scale, ExternalLink, Loader2, Microscope, FlaskConical, ClipboardCheck, BarChart3 } from "lucide-react";
import { getApiUrl } from "@/lib/config";
import { createCellSlug } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Interface igual à do Explorer
interface Cell {
    Brand: string;
    CellModelNo: string;
    Composition: string;
    Cell_Stack: string;
    MaxContinuousDischargeRate: number;
    MaxContinuousChargeRate: number;
    NominalVoltage: number;
    Capacity: number;
    Impedance: number;
    Weight: number;
    Cell_Thickness: number;
    Cell_Width: number;
    Cell_Height: number;
    Cycles: number;
    Connection: string;
}

const CellDetails = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [cell, setCell] = useState<Cell | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCellData = async () => {
            setIsLoading(true);
            try {
                const url = getApiUrl("cells");
                const res = await fetch(url);
                if (!res.ok) throw new Error("Failed to fetch data");
                const data: Cell[] = await res.json();

                // Encontrar a célula que corresponde ao Slug
                const foundCell = data.find(c =>
                    createCellSlug(c.Brand, c.CellModelNo) === slug
                );

                if (foundCell) {
                    setCell(foundCell);
                    document.title = `${foundCell.Brand} ${foundCell.CellModelNo} Specs | Watt Builder`;
                } else {
                    toast({ title: "Cell not found", variant: "destructive" });
                }
            } catch (error) {
                console.error(error);
                toast({ title: "Error loading cell details", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchCellData();
    }, [slug, toast]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navigation />
                <div className="flex-grow flex justify-center items-center">
                    <Loader2 className="w-16 h-16 animate-spin text-accent" />
                </div>
                <Footer />
            </div>
        );
    }

    if (!cell) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navigation />
                <div className="flex-grow flex flex-col justify-center items-center gap-4">
                    <h1 className="text-2xl font-bold">Cell Not Found</h1>
                    <Link to="/cell-explorer"><Button>Back to Explorer</Button></Link>
                </div>
                <Footer />
            </div>
        );
    }

    // Cálculos
    const energyWh = (cell.Capacity / 1000) * cell.NominalVoltage;
    const powerW = energyWh * cell.MaxContinuousDischargeRate;
    const volumeMm3 = cell.Cell_Height * cell.Cell_Width * cell.Cell_Thickness;
    const volumeL = volumeMm3 / 1_000_000;
    const safeVolumeL = volumeL === 0 ? 0.001 : volumeL;
    const energyDensityWhL = energyWh / safeVolumeL;
    const powerDensityWL = powerW / safeVolumeL;

    const handleGetData = () => {
        const cellName = `${cell.Brand || "Unknown"} ${cell.CellModelNo}`;
        const messageTemplate = `Hello,\nI would like to get the following data about the ${cellName} cell:\n\n\nBest regards,\n`;
        const encodedMessage = encodeURIComponent(messageTemplate);
        navigate(`/contact?message=${encodedMessage}`);
    };

    const AffiliateLink = ({ link }: { link?: string }) => {
        if (!link || link === "Solder" || link === "") return null;
        return (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1 mt-2 font-medium">
                Buy from Affiliate <ExternalLink className="inline w-4 h-4" />
            </a>
        );
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navigation />

            <main className="flex-grow pt-32 pb-16">
                <div className="container px-4 mx-auto max-w-5xl">
                    <Link to="/cell-explorer">
                        <Button variant="ghost" className="mb-6 hover:-translate-x-1 transition-transform">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Explorer
                        </Button>
                    </Link>

                    {/* Header Section */}
                    <div className="mb-10">
                        <div className="inline-block px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium mb-4">
                            {cell.Composition}
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
                            {cell.Brand} <span className="text-accent">{cell.CellModelNo}</span>
                        </h1>
                        <p className="text-xl text-muted-foreground">High-performance {cell.Cell_Stack} cell for advanced applications.</p>
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Left Column: Key Specs & Dimensions */}
                        <div className="lg:col-span-2 space-y-8">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><Battery className="text-accent" /> Electrical Specifications</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Nominal Capacity</p>
                                        <p className="text-2xl font-semibold">{(cell.Capacity / 1000).toFixed(2)} Ah</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Nominal Voltage</p>
                                        <p className="text-2xl font-semibold">{cell.NominalVoltage.toFixed(2)} V</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Stored Energy</p>
                                        <p className="text-2xl font-semibold">{energyWh.toFixed(2)} Wh</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Internal Impedance</p>
                                        <p className="text-2xl font-semibold">{cell.Impedance} mΩ</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><Zap className="text-accent" /> Power Performance</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Max Continuous Discharge</p>
                                        <p className="text-xl font-medium">{cell.MaxContinuousDischargeRate} C</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Max Continuous Charge</p>
                                        <p className="text-xl font-medium">{cell.MaxContinuousChargeRate} C</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Continuous Power Output</p>
                                        <p className="text-xl font-medium">{powerW.toFixed(0)} W</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Cycle Life</p>
                                        <p className="text-xl font-medium">{cell.Cycles} cycles</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: Physical & Actions */}
                        <div className="space-y-8">
                            <Card className="bg-muted/30 border-accent/20">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><Scale className="text-accent" /> Physical</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-muted-foreground">Weight</span>
                                        <span className="font-semibold">{cell.Weight} g</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-muted-foreground">Height</span>
                                        <span className="font-semibold">{cell.Cell_Height} mm</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-muted-foreground">Width</span>
                                        <span className="font-semibold">{cell.Cell_Width} mm</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-muted-foreground">Thickness</span>
                                        <span className="font-semibold">{cell.Cell_Thickness} mm</span>
                                    </div>
                                    <div className="pt-2">
                                        <p className="text-sm text-muted-foreground mb-1">Volumetric Energy Density</p>
                                        <p className="text-xl font-semibold">{energyDensityWhL.toFixed(0)} Wh/L</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                <Button size="lg" className="w-full text-lg h-12" onClick={handleGetData}>
                                    Request Full Datasheet
                                </Button>
                                <div className="text-center">
                                    <AffiliateLink link={cell.Connection} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Nova Secção: Serviços de Teste de Células */}

            <section className="py-24 bg-muted/30 w-full">
                <div className="container px-4 mx-auto max-w-5xl text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full text-accent font-medium mb-6">
                        <Microscope size={18} />
                        <span>Independent Validation</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                        Need to verify these specs?
                    </h2>
                    <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
                        We offer professional validation services for the <strong>{cell.Brand} {cell.CellModelNo}</strong> and other cells.
                        Our state-of-the-art lab ensures you get accurate, unbiased data.
                    </p>

                    <div className="grid md:grid-cols-3 gap-8 mb-12 text-left">
                        <Card className="bg-background border-border shadow-sm">
                            <CardHeader>
                                <FlaskConical className="w-10 h-10 text-accent mb-4" />
                                <CardTitle>Performance Verification</CardTitle>
                                <CardDescription>
                                    Confirm the manufacturer's capacity, voltage curves, and internal resistance claims.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="bg-background border-border shadow-sm">
                            <CardHeader>
                                <ClipboardCheck className="w-10 h-10 text-accent mb-4" />
                                <CardTitle>Cycle Life Testing</CardTitle>
                                <CardDescription>
                                    Long-term cycling tests to determine real-world lifespan and degradation patterns.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="bg-background border-border shadow-sm">
                            <CardHeader>
                                <BarChart3 className="w-10 h-10 text-accent mb-4" />
                                <CardTitle>Thermal Analysis</CardTitle>
                                <CardDescription>
                                    Monitor temperature profiles under heavy load to ensure safety and thermal stability.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>

                    <Button size="lg" variant="outline" className="text-lg px-8 py-6 h-auto border-accent text-accent hover:bg-accent hover:text-white" onClick={() => navigate("/contact")}>
                        Contact Us for Custom Testing
                    </Button>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default CellDetails;