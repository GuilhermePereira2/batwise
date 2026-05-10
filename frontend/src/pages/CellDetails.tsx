import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Battery, Zap, Scale, ExternalLink, Loader2, Microscope, FlaskConical, ClipboardCheck, BarChart3, Box } from "lucide-react";
import { getApiUrl } from "@/lib/config";
import { createCellSlug } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Cell3DViewer } from "@/components/Cell3DViewer";

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
    const { t } = useTranslation();
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

                const foundCell = data.find(c =>
                    createCellSlug(c.Brand, c.CellModelNo) === slug
                );

                if (foundCell) {
                    setCell(foundCell);
                    document.title = `${foundCell.Brand} ${foundCell.CellModelNo} ${t('cellDetails.specsTitle')}`;
                } else {
                    toast({ title: t('cellDetails.toasts.notFound'), variant: "destructive" });
                }
            } catch (error) {
                console.error(error);
                toast({ title: t('cellDetails.toasts.errorLoading'), variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchCellData();
    }, [slug, toast, t]);

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
                    <h1 className="text-2xl font-bold">{t('cellDetails.notFound.title')}</h1>
                    <Link to="/cell-explorer"><Button>{t('cellDetails.backToExplorer')}</Button></Link>
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
    const energyDensityWhKg = energyWh / (cell.Weight / 1000);

    const handleGetData = () => {
        const cellName = `${cell.Brand || "Unknown"} ${cell.CellModelNo}`;
        const messageTemplate = t('cellDetails.contactTemplate', { cellName });
        const encodedMessage = encodeURIComponent(messageTemplate);
        navigate(`/contact?message=${encodedMessage}`);
    };

    const AffiliateLink = ({ link }: { link?: string }) => {
        if (!link || link === "Solder" || link === "") return null;
        return (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1 mt-2 font-medium">
                {t('cellDetails.buyAffiliate')} <ExternalLink className="inline w-4 h-4" />
            </a>
        );
    };

    // Formatar tipo de célula
    let stackType = cell.Cell_Stack?.replace(/C\s*-\s*/, '') || '';
    if (cell.Cell_Stack && /C\s*-\s*\d+/.test(cell.Cell_Stack)) {
        stackType = `${t('cellDetails.cylindrical')} ${stackType}`;
    }
    const cellTypeStr = stackType ? `${stackType} ${t('cellDetails.cell')}` : t('cellDetails.cell');

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navigation />

            <main className="flex-grow pt-32 pb-16">
                <div className="container px-4 mx-auto max-w-5xl">
                    <Link to="/cell-explorer">
                        <Button variant="ghost" className="mb-6 hover:-translate-x-1 transition-transform">
                            <ArrowLeft className="mr-2 h-4 w-4" /> {t('cellDetails.backToExplorer')}
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
                        <p className="text-lg text-muted-foreground">
                            {t('cellDetails.subtitle', { type: cellTypeStr })}
                        </p>
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* Left Column: Key Specs & Dimensions */}
                        <div className="space-y-8">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><Battery className="text-accent" /> {t('cellDetails.electrical.title')}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.electrical.capacity')}</p>
                                        <p className="text-2xl font-semibold">{(cell.Capacity / 1000).toFixed(2)} Ah</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.electrical.voltage')}</p>
                                        <p className="text-2xl font-semibold">{cell.NominalVoltage.toFixed(2)} V</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.electrical.energy')}</p>
                                        <p className="text-2xl font-semibold">{energyWh.toFixed(2)} Wh</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.electrical.impedance')}</p>
                                        <p className="text-2xl font-semibold">{cell.Impedance} mΩ</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><Zap className="text-accent" /> {t('cellDetails.power.title')}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.power.maxDischarge')}</p>
                                        <p className="text-xl font-medium">{cell.MaxContinuousDischargeRate} C</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.power.maxCharge')}</p>
                                        <p className="text-xl font-medium">{cell.MaxContinuousChargeRate} C</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.power.contOutput')}</p>
                                        <p className="text-xl font-medium">{powerW.toFixed(0)} W</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.power.cycleLife')}</p>
                                        <p className="text-xl font-medium">{cell.Cycles} {t('cellDetails.power.cycles')}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><Scale className="text-accent" /> {t('cellDetails.physical.title')}</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.physical.weight')}</p>
                                        <p className="text-xl font-semibold">{cell.Weight} g</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.physical.height')}</p>
                                        <p className="text-xl font-semibold">{cell.Cell_Height} mm</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.physical.width')}</p>
                                        <p className="text-xl font-semibold">{cell.Cell_Width} mm</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.physical.thickness')}</p>
                                        <p className="text-xl font-semibold">{cell.Cell_Thickness} mm</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.physical.volumetric')}</p>
                                        <p className="text-xl font-semibold">{energyDensityWhL.toFixed(0)} Wh/L</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{t('cellDetails.physical.gravimetric')}</p>
                                        <p className="text-xl font-semibold">{energyDensityWhKg.toFixed(0)} Wh/kg</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: 3D Model & Actions */}
                        <div className="space-y-8">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><Box className="text-accent" /> {t('cellDetails.3d.title')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Cell3DViewer
                                        width={cell.Cell_Width}
                                        height={cell.Cell_Height}
                                        thickness={cell.Cell_Thickness}
                                        arrowOffset={0.5}
                                    />
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                <Button size="lg" className="w-full text-lg h-12" onClick={handleGetData}>
                                    {t('cellDetails.actions.requestData')}
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
                        <span>{t('cellDetails.testing.badge')}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                        {t('cellDetails.testing.title')}
                    </h2>
                    <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
                        {t('cellDetails.testing.desc1')} <strong>{cell.Brand} {cell.CellModelNo}</strong> {t('cellDetails.testing.desc2')}
                    </p>

                    <div className="grid md:grid-cols-3 gap-8 mb-12 text-left">
                        <Card className="bg-background border-border shadow-sm">
                            <CardHeader>
                                <FlaskConical className="w-10 h-10 text-accent mb-4" />
                                <CardTitle>{t('cellDetails.testing.perfTitle')}</CardTitle>
                                <CardDescription>
                                    {t('cellDetails.testing.perfDesc')}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="bg-background border-border shadow-sm">
                            <CardHeader>
                                <ClipboardCheck className="w-10 h-10 text-accent mb-4" />
                                <CardTitle>{t('cellDetails.testing.cycleTitle')}</CardTitle>
                                <CardDescription>
                                    {t('cellDetails.testing.cycleDesc')}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="bg-background border-border shadow-sm">
                            <CardHeader>
                                <BarChart3 className="w-10 h-10 text-accent mb-4" />
                                <CardTitle>{t('cellDetails.testing.thermalTitle')}</CardTitle>
                                <CardDescription>
                                    {t('cellDetails.testing.thermalDesc')}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>

                    <Button size="lg" className="text-lg px-8 py-6 h-auto" onClick={() => navigate("/contact")}>
                        {t('cellDetails.testing.contactBtn')}
                    </Button>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default CellDetails;