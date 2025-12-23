import { useState, useEffect, useMemo } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Search, Loader2, Database, X, ExternalLink, RefreshCw, LayoutGrid, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// --- Types ---
interface Cell {
    Brand: string;
    CellModelNo: string;
    Composition: string; // The data key from your API is still 'Composition'
    Cell_Stack: string;
    MaxContinuousDischargeRate: number;
    MaxContinuousChargeRate: number;
    NominalVoltage: number;
    ChargeVoltage: number;
    Capacity: number; // mAh
    TheMaxDischargeCurrentOfTheTabs: number;
    Impedance: number;
    Weight: number;
    Cell_Thickness: number;
    Cell_Width: number;
    Cell_Height: number;
    TabsThickness: number;
    TabsWidth: number;
    TabsLength: number;
    DistanceBetweenTwoTabs: number;
    VolumeEnergyDensity: number;
    PowerEnergyDensity: number;
    Cycles: number;
    Price: number;
    OriginCountry: string;
    Connection: string;
}

// Renamed to 'chemistries'
interface FilterOptions {
    brands: string[];
    chemistries: string[];
    cellStacks: string[];
    connections: string[];
}
interface FilterBoundaries {
    capacity: [number, number];
    weight: [number, number];
    price: [number, number];
    dischargeRate: [number, number];
    chargeRate: [number, number];
    impedance: [number, number];
    cycles: [number, number];
}
// Renamed to 'chemistry'
interface FilterValues {
    searchQuery: string;
    brand: string;
    chemistry: string;
    cellStack: string;
    capacity: [number, number];
    weight: [number, number];
    price: [number, number];
    dischargeRate: [number, number];
    chargeRate: [number, number];
    impedance: [number, number];
    cycles: [number, number];
}
interface ChartCellData extends Cell {
    capacityAh: number;
    energyWh: number;
    powerW: number;
    volumeL: number;
    energyDensityWhL: number;
    powerDensityWL: number;
}
// --- End Types ---

// Set to 21 cells per page
const CELLS_PER_PAGE = 21;

// Helper: RangeSliderFilter
const RangeSliderFilter: React.FC<{
    label: string;
    value: [number, number];
    min: number;
    max: number;
    step?: number;
    unit: string;
    onChange: (value: [number, number]) => void;
}> = ({ label, value, min, max, step = 1, unit, onChange }) => (
    <div className="space-y-3">
        <div className="flex justify-between items-center">
            <Label className="text-sm">{label}</Label>
            <span className="text-xs font-medium text-muted-foreground">
                {value[0]} - {value[1]} {unit}
            </span>
        </div>
        <Slider
            value={value}
            min={min}
            max={max}
            step={step}
            onValueChange={onChange}
        />
    </div>
);

// --- Main Component ---
const CellExplorer = () => {
    const [allCells, setAllCells] = useState<Cell[]>([]);
    const [filteredCells, setFilteredCells] = useState<Cell[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const { toast } = useToast();

    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
    const [filterBoundaries, setFilterBoundaries] = useState<FilterBoundaries | null>(null);
    const [filterValues, setFilterValues] = useState<FilterValues | null>(null);

    const [activeTab, setActiveTab] = useState("chart");
    const [xAxis, setXAxis] = useState("capacityAh");
    const [yAxis, setYAxis] = useState("energyWh");

    // Set browser tab title
    useEffect(() => {
        document.title = "Cell Explorer | Watt Builder";
    }, []);

    // Fetch data from API
    useEffect(() => {
        const fetchCellCatalogue = async () => {
            setIsLoading(true);
            // Define a base do URL (ex: http://localhost:8000)
            const BASE_URL = import.meta.env.VITE_BATTERY_DESIGN_URL
                ? import.meta.env.VITE_BATTERY_DESIGN_URL
                : "http://127.0.0.1:8000";
            try {
                console.log(`📡 A conectar a: ${BASE_URL}/cells`); // Debug Log
                // ALTERAÇÃO AQUI: Adicionar '/cells' ao final do URL
                const res = await fetch(`${BASE_URL}/cells`, {
                    method: 'GET', headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (!res.ok) throw new Error(`Failed to fetch (status: ${res.status})`);

                const data: Cell[] = await res.json();

                // Validação de segurança básica: garantir que é um array
                if (!Array.isArray(data)) {
                    throw new Error("Formato de dados inválido recebido da API");
                }

                setAllCells(data);
                setFilteredCells(data);

                const getOptions = (key: keyof Cell) => [
                    ...new Set(data.map(c => c[key] as string).filter(Boolean))
                ].sort();

                const options: FilterOptions = {
                    brands: getOptions('Brand'),
                    chemistries: getOptions('Composition'), // Data key 'Composition' maps to state 'chemistries'
                    cellStacks: getOptions('Cell_Stack'),
                    connections: getOptions('Connection'),
                };
                setFilterOptions(options);

                const getMinMax = (key: keyof Cell): [number, number] => {
                    const values = data.map(c => c[key] as number);
                    const min = Math.floor(Math.min(...values));
                    const max = Math.ceil(Math.max(...values));
                    return [min, max];
                };

                const boundaries: FilterBoundaries = {
                    capacity: getMinMax('Capacity'),
                    weight: getMinMax('Weight'),
                    price: getMinMax('Price'),
                    dischargeRate: getMinMax('MaxContinuousDischargeRate'),
                    chargeRate: getMinMax('MaxContinuousChargeRate'),
                    impedance: getMinMax('Impedance'),
                    cycles: getMinMax('Cycles'),
                };
                setFilterBoundaries(boundaries);

                setFilterValues({
                    searchQuery: "",
                    brand: "all",
                    chemistry: "all", // Renamed from 'composition'
                    cellStack: "all",
                    ...boundaries
                });

            } catch (error: any) {
                toast({ title: "Error fetching cells", description: error.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchCellCatalogue();
    }, [toast]);

    // Filtering Logic
    useEffect(() => {
        if (!filterValues || allCells.length === 0) return;
        const query = filterValues.searchQuery.toLowerCase();

        const cells = allCells.filter(cell => {
            if (query && !cell.CellModelNo.toLowerCase().includes(query) && !cell.Brand.toLowerCase().includes(query)) return false;
            if (filterValues.brand !== "all" && cell.Brand !== filterValues.brand) return false;
            // Compare data 'Composition' with state 'chemistry'
            if (filterValues.chemistry !== "all" && cell.Composition !== filterValues.chemistry) return false;
            if (filterValues.cellStack !== "all" && cell.Cell_Stack !== filterValues.cellStack) return false;
            if (cell.Capacity < filterValues.capacity[0] || cell.Capacity > filterValues.capacity[1]) return false;
            if (cell.Weight < filterValues.weight[0] || cell.Weight > filterValues.weight[1]) return false;
            if (cell.Price < filterValues.price[0] || cell.Price > filterValues.price[1]) return false;
            if (cell.MaxContinuousDischargeRate < filterValues.dischargeRate[0] || cell.MaxContinuousDischargeRate > filterValues.dischargeRate[1]) return false;
            if (cell.MaxContinuousChargeRate < filterValues.chargeRate[0] || cell.MaxContinuousChargeRate > filterValues.chargeRate[1]) return false;
            if (cell.Impedance < filterValues.impedance[0] || cell.Impedance > filterValues.impedance[1]) return false;
            if (cell.Cycles < filterValues.cycles[0] || cell.Cycles > filterValues.cycles[1]) return false;
            return true;
        });
        setFilteredCells(cells);
        setCurrentPage(1);
    }, [allCells, filterValues]);

    // Pagination Logic
    const pageCount = Math.ceil(filteredCells.length / CELLS_PER_PAGE);
    const paginatedCells = useMemo(() => {
        const startIndex = (currentPage - 1) * CELLS_PER_PAGE;
        const endIndex = startIndex + CELLS_PER_PAGE;
        return filteredCells.slice(startIndex, endIndex);
    }, [filteredCells, currentPage]);

    // --- Event Handlers ---
    const handleFilterChange = (key: keyof FilterValues, value: any) => {
        setFilterValues(prev => prev ? { ...prev, [key]: value } : null);
    };
    const resetFilters = () => {
        if (filterBoundaries) {
            setFilterValues({
                searchQuery: "",
                brand: "all",
                chemistry: "all", // Renamed
                cellStack: "all",
                ...filterBoundaries
            });
        }
    };
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        document.getElementById("cell-explorer-top")?.scrollIntoView({ behavior: "smooth" });
    };
    // --- End Handlers ---

    // --- Chart Helpers ---
    const formatAxisLabel = (key: string) => {
        switch (key) {
            case "capacityAh": return "Capacity (Ah)";
            case "NominalVoltage": return "Nominal Voltage (V)";
            case "Weight": return "Weight (g)";
            case "MaxContinuousDischargeRate": return "Discharge Rate (C)";
            case "MaxContinuousChargeRate": return "Charge Rate (C)";
            case "Impedance": return "Impedance (mΩ)";
            case "Cycles": return "Cycles";
            case "energyWh": return "Energy (Wh)";
            case "powerW": return "Power (W)";
            case "volumeL": return "Volume (L)";
            case "energyDensityWhL": return "Energy Density (Wh/L)";
            case "powerDensityWL": return "Power Density (W/L)";
            default: return key.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
        }
    };
    const chartData = useMemo(() => {
        return filteredCells.map(cell => {
            const capacityAh = cell.Capacity / 1000;
            const energyWh = capacityAh * cell.NominalVoltage;
            const powerW = energyWh * cell.MaxContinuousDischargeRate;
            const volumeMm3 = cell.Cell_Height * cell.Cell_Width * cell.Cell_Thickness;
            const volumeL = volumeMm3 / 1_000_000;
            const safeVolumeL = volumeL === 0 ? 0.001 : volumeL;
            const energyDensityWhL = energyWh / safeVolumeL;
            const powerDensityWL = powerW / safeVolumeL;
            return {
                ...cell,
                capacityAh,
                energyWh,
                powerW,
                volumeL,
                energyDensityWhL,
                powerDensityWL,
            } as ChartCellData;
        });
    }, [filteredCells]);
    const chartAxisOptions = [
        { value: "capacityAh", label: "Capacity (Ah)" },
        { value: "Weight", label: "Weight (g)" },
        { value: "MaxContinuousDischargeRate", label: "Discharge Rate (C)" },
        { value: "MaxContinuousChargeRate", label: "Charge Rate (C)" },
        { value: "Impedance", label: "Impedance (mΩ)" },
        { value: "Cycles", label: "Cycles" },
        { value: "energyWh", label: "Energy (Wh)" },
        { value: "powerW", label: "Power (W)" },
        { value: "volumeL", label: "Volume (L)" },
        { value: "energyDensityWhL", label: "Energy Density (Wh/L)" },
        { value: "powerDensityWL", label: "Power Density (W/L)" },
    ];

    const chemistryColors = useMemo(() => {
        const colors: { [key: string]: string } = {};
        const baseColors = [
            "hsl(10 84% 50%)",
            "hsl(220 84% 60%)",
            "hsl(140 70% 50%)",
            "hsl(40 90% 60%)",
            "hsl(280 60% 70%)",
            "hsl(180 70% 50%)",
            "hsl(320 80% 70%)",
            "hsl(60 80% 50%)",
        ];
        let colorIndex = 0;
        filterOptions?.chemistries.forEach(comp => { // Renamed from 'compositions'
            if (!colors[comp]) {
                colors[comp] = baseColors[colorIndex % baseColors.length];
                colorIndex++;
            }
        });
        return colors;
    }, [filterOptions]);
    // --- End Chart Helpers ---

    // Render Loading State
    if (isLoading || !filterValues || !filterBoundaries || !filterOptions) {
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

    // --- Main Render ---
    return (
        <div className="min-h-screen flex flex-col">
            <Navigation />

            {/* Hero Section */}
            <section id="cell-explorer-top" className="relative min-h-[60vh] flex items-center justify-center overflow-hidden mt-16 bg-gradient-to-br from-background via-muted/30 to-background">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
                </div>
                <div className="container relative z-10 px-4 py-20 mx-auto text-center animate-fade-in">
                    <div className="flex justify-center mb-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full text-accent font-medium">
                            <Database size={18} />
                            <span>Cell Database Explorer</span>
                        </div>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
                        Explore our<br />Battery Cell Database
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
                        Search, filter, and compare battery cells for your next project.
                    </p>
                </div>
            </section>

            {/* Main Content Area with Sidebar Layout */}
            <section className="py-24 bg-background">
                <div className="container px-4 mx-auto max-w-7xl">

                    {/* Page Title */}
                    <div className="text-center mb-12 animate-slide-up">
                        <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                            Cell Explorer
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Use the filters to find the perfect cell for your project.
                        </p>
                    </div>

                    {/* Sidebar Grid Layout (1/4 filters, 3/4 content) */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 lg:gap-8">

                        {/* --- Filter Column (Sidebar) --- */}
                        <aside className="lg:col-span-1">
                            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
                                <Card className="shadow-soft mb-12 lg:mb-0">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle>Cell Filters</CardTitle>
                                        <Button variant="outline" size="icon" onClick={resetFilters}>
                                            <RefreshCw className="w-4 h-4" />
                                            <span className="sr-only">Reset Filters</span>
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <div className="grid grid-cols-1 gap-y-4">

                                            {/* Group 1: Text & Selects */}
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="search">Search</Label>
                                                    <Input id="search" placeholder="e.g., LF280K or EVE"
                                                        value={filterValues.searchQuery}
                                                        onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Brand</Label>
                                                    <Select value={filterValues.brand} onValueChange={(v) => handleFilterChange('brand', v)}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">All Brands</SelectItem>
                                                            {filterOptions.brands.map(opt => <SelectItem key={opt} value={opt}>{opt || "Unknown"}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Chemistry</Label>
                                                    <Select value={filterValues.chemistry} onValueChange={(v) => handleFilterChange('chemistry', v)}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">All Chemistries</SelectItem>
                                                            {filterOptions.chemistries.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {/* Group 2: Sliders */}
                                            <div className="space-y-4 pt-2">
                                                <RangeSliderFilter
                                                    label="Capacity" unit="mAh"
                                                    min={filterBoundaries.capacity[0]}
                                                    max={filterBoundaries.capacity[1]}
                                                    value={filterValues.capacity}
                                                    step={1000}
                                                    onChange={(v) => handleFilterChange('capacity', v)}
                                                />
                                                <RangeSliderFilter
                                                    label="Weight" unit="g"
                                                    min={filterBoundaries.weight[0]}
                                                    max={filterBoundaries.weight[1]}
                                                    value={filterValues.weight}
                                                    step={50}
                                                    onChange={(v) => handleFilterChange('weight', v)}
                                                />
                                                <RangeSliderFilter
                                                    label="Price" unit="€"
                                                    min={filterBoundaries.price[0]}
                                                    max={filterBoundaries.price[1]}
                                                    value={filterValues.price}
                                                    step={1}
                                                    onChange={(v) => handleFilterChange('price', v)}
                                                />
                                            </div>

                                            {/* Group 3: Sliders */}
                                            <div className="space-y-4 pt-2">
                                                <RangeSliderFilter
                                                    label="Discharge Rate" unit="C"
                                                    min={filterBoundaries.dischargeRate[0]}
                                                    max={filterBoundaries.dischargeRate[1]}
                                                    value={filterValues.dischargeRate}
                                                    step={0.5}
                                                    onChange={(v) => handleFilterChange('dischargeRate', v)}
                                                />
                                                <RangeSliderFilter
                                                    label="Charge Rate" unit="C"
                                                    min={filterBoundaries.chargeRate[0]}
                                                    max={filterBoundaries.chargeRate[1]}
                                                    value={filterValues.chargeRate}
                                                    step={0.5}
                                                    onChange={(v) => handleFilterChange('chargeRate', v)}
                                                />
                                                <RangeSliderFilter
                                                    label="Impedance" unit="mΩ"
                                                    min={filterBoundaries.impedance[0]}
                                                    max={filterBoundaries.impedance[1]}
                                                    value={filterValues.impedance}
                                                    step={0.1}
                                                    onChange={(v) => handleFilterChange('impedance', v)}
                                                />
                                                <RangeSliderFilter
                                                    label="Cycles" unit=""
                                                    min={filterBoundaries.cycles[0]}
                                                    max={filterBoundaries.cycles[1]}
                                                    value={filterValues.cycles}
                                                    step={100}
                                                    onChange={(v) => handleFilterChange('cycles', v)}
                                                />
                                            </div>

                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </aside>

                        {/* --- Content Column (3/4) --- */}
                        <main className="lg:col-span-3">
                            {filteredCells.length > 0 ? (
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <div className="flex justify-between items-center mb-6">
                                        <TabsList className="grid w-full grid-cols-2 max-w-xs">
                                            <TabsTrigger value="chart"> {/* Chart first */}
                                                <BarChart3 className="w-4 h-4 mr-2" />
                                                Chart View
                                            </TabsTrigger>
                                            <TabsTrigger value="grid">
                                                <LayoutGrid className="w-4 h-4 mr-2" />
                                                Grid View
                                            </TabsTrigger>
                                        </TabsList>
                                        <p className="text-sm text-muted-foreground hidden lg:block">
                                            Found {filteredCells.length} matching cells
                                            {activeTab === 'grid' && ` (showing ${paginatedCells.length})`}
                                        </p>
                                    </div>

                                    {/* TAB 1: GRID VIEW */}
                                    <TabsContent value="grid">
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {paginatedCells.map((cell) => (
                                                <Card
                                                    key={cell.CellModelNo}
                                                    className="shadow-soft hover:shadow-lg transition-shadow cursor-pointer"
                                                    onClick={() => setSelectedCell(cell)}
                                                >
                                                    <CardHeader>
                                                        <CardTitle className="text-lg">{cell.CellModelNo}</CardTitle>
                                                        <CardDescription>{cell.Brand || "Unknown"} - {cell.Composition}</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="text-sm space-y-2">
                                                        <p><strong>Capacity:</strong> {(cell.Capacity / 1000).toFixed(2)} Ah</p>
                                                        <p><strong>Voltage:</strong> {cell.NominalVoltage.toFixed(1)} V</p>
                                                        <p><strong>Weight:</strong> {cell.Weight} g</p>
                                                        <p><strong>Discharge:</strong> {cell.MaxContinuousDischargeRate} C</p>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>

                                        {pageCount > 1 && (
                                            <Pagination className="mt-12">
                                                <PaginationContent>
                                                    <PaginationItem>
                                                        <PaginationPrevious
                                                            href="#"
                                                            onClick={(e) => { e.preventDefault(); handlePageChange(Math.max(1, currentPage - 1)); }}
                                                            className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                                                        />
                                                    </PaginationItem>
                                                    {[...Array(pageCount)].map((_, i) => (
                                                        <PaginationItem key={i + 1}>
                                                            <PaginationLink
                                                                href="#"
                                                                isActive={currentPage === i + 1}
                                                                onClick={(e) => { e.preventDefault(); handlePageChange(i + 1); }}
                                                            >
                                                                {i + 1}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    ))}
                                                    <PaginationItem>
                                                        <PaginationNext
                                                            href="#"
                                                            onClick={(e) => { e.preventDefault(); handlePageChange(Math.min(pageCount, currentPage + 1)); }}
                                                            className={currentPage === pageCount ? "pointer-events-none opacity-50" : ""}
                                                        />
                                                    </PaginationItem>
                                                </PaginationContent>
                                            </Pagination>
                                        )}
                                    </TabsContent>

                                    {/* TAB 2: CHART VIEW (GRÁFICO) */}
                                    <TabsContent value="chart">
                                        <div className="space-y-4">
                                            {/* Selectors para os Eixos */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>X-Axis Parameter</Label>
                                                    <Select value={xAxis} onValueChange={setXAxis}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {chartAxisOptions.map(opt => (
                                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Y-Axis Parameter</Label>
                                                    <Select value={yAxis} onValueChange={setYAxis}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {chartAxisOptions.map(opt => (
                                                                < SelectItem key={opt.value} value={opt.value} > {opt.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {/* Gráfico */}
                                            <div className="relative w-full h-[600px] overflow-hidden">
                                                <ChartContainer config={{}}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <ScatterChart margin={{ top: 20, right: 30, bottom: 90, left: 40 }}>
                                                            <CartesianGrid strokeDasharray="3 3" />
                                                            <XAxis
                                                                type="number"
                                                                dataKey={xAxis}
                                                                name={formatAxisLabel(xAxis)}
                                                                domain={['dataMin', 'dataMax']}
                                                                label={{ value: formatAxisLabel(xAxis), position: 'bottom', offset: 30 }}
                                                                tickFormatter={(value) => {
                                                                    if (xAxis === "capacityAh") return `${value.toFixed(1)} Ah`;
                                                                    if (xAxis === "energyWh") return `${value.toFixed(0)} Wh`;
                                                                    if (xAxis === "powerW") return `${value.toFixed(0)} W`;
                                                                    if (xAxis === "volumeL") return `${value.toFixed(1)} L`;
                                                                    if (xAxis === "energyDensityWhL") return `${value.toFixed(0)} Wh/L`;
                                                                    if (xAxis === "powerDensityWL") return `${value.toFixed(0)} W/L`;
                                                                    return String(value);
                                                                }}
                                                            />

                                                            <YAxis
                                                                type="number"
                                                                dataKey={yAxis}
                                                                name={formatAxisLabel(yAxis)}
                                                                domain={['dataMin', 'dataMax']}
                                                                label={{ value: formatAxisLabel(yAxis), angle: -90, position: 'insideLeft', offset: -20 }}
                                                                tickFormatter={(value) => {
                                                                    if (yAxis === "capacityAh") return `${value.toFixed(1)} Ah`;
                                                                    if (yAxis === "energyWh") return `${value.toFixed(0)} Wh`;
                                                                    if (yAxis === "powerW") return `${value.toFixed(0)} W`;
                                                                    if (yAxis === "volumeL") return `${value.toFixed(1)} L`;
                                                                    if (yAxis === "energyDensityWhL") return `${value.toFixed(0)} Wh/L`;
                                                                    if (yAxis === "powerDensityWL") return `${value.toFixed(0)} W/L`;
                                                                    return String(value);
                                                                }}
                                                            />
                                                            <ChartTooltip
                                                                content={({ active, payload }) => {
                                                                    if (active && payload && payload.length) {
                                                                        const data = payload[0].payload as ChartCellData;
                                                                        return (
                                                                            <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
                                                                                <p className="font-semibold">{data.CellModelNo}</p>
                                                                                <p className="text-sm text-muted-foreground">{data.Brand} - {data.Composition}</p>
                                                                                <hr className="my-1" />
                                                                                <p className="text-sm">
                                                                                    {formatAxisLabel(xAxis)}: {
                                                                                        // @ts-ignore
                                                                                        `${(data as any)[xAxis].toFixed(1)}`
                                                                                    }</p>
                                                                                <p className="text-sm">
                                                                                    {formatAxisLabel(yAxis)}: {
                                                                                        // @ts-ignore
                                                                                        `${(data as any)[yAxis].toFixed(1)}`
                                                                                    }
                                                                                </p>

                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                }}
                                                            />
                                                            {/* ALTERAÇÃO: Renomeado */}
                                                            {filterOptions.chemistries.map(chemistry => (
                                                                <Scatter
                                                                    key={chemistry}
                                                                    name={chemistry}
                                                                    data={chartData.filter(cell => cell.Composition === chemistry)} // A data key 'Composition' é usada para filtrar
                                                                    fill={chemistryColors[chemistry] || "hsl(var(--muted))"}
                                                                    fillOpacity={0.7}
                                                                    shape={(props) => <circle {...props} r={5} onClick={() => setSelectedCell(props.payload)} />} // Bolas maiores e com clique
                                                                />
                                                            ))}
                                                        </ScatterChart>
                                                    </ResponsiveContainer>
                                                </ChartContainer>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            ) : (
                                <div className="flex flex-col justify-center items-center min-h-[300px] text-center">
                                    <Database className="w-20 h-20 text-muted-foreground/30 mb-6" />
                                    <h3 className="text-2xl font-semibold mb-2">No Cells Found</h3>
                                    <p className="text-muted-foreground">
                                        Try adjusting your search or filter criteria.
                                    </p>
                                </div>
                            )}
                        </main>

                    </div> {/* Fim do grid 1/4 - 3/4 */}
                </div>
            </section >

            <Footer />

            {
                selectedCell && (
                    <CellDetailModal
                        cell={selectedCell}
                        isOpen={!!selectedCell}
                        onClose={() => setSelectedCell(null)}
                    />
                )
            }
        </div >
    );
};


// --- Modal de Detalhe da Célula (sem alteração) ---
const CellDetailModal = ({ cell, isOpen, onClose }: { cell: Cell, isOpen: boolean, onClose: () => void }) => {
    const { toast } = useToast();

    const AffiliateLink = ({ link }: { link?: string }) => {
        if (!link || link === "Solder") return null;
        return (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1 mt-1">
                Buy from Affiliate <ExternalLink className="inline w-3 h-3" />
            </a>
        );
    };

    // --- Novos Cálculos ---
    const energyWh = (cell.Capacity / 1000) * cell.NominalVoltage;
    const powerW = energyWh * cell.MaxContinuousDischargeRate;
    const volumeMm3 = cell.Cell_Height * cell.Cell_Width * cell.Cell_Thickness;
    const volumeCm3 = volumeMm3 / 1000;
    const volumeL = volumeMm3 / 1000000;
    const safeVolumeL = volumeL === 0 ? 1 : volumeL;
    const energyDensityWhL = energyWh / safeVolumeL;
    const powerDensityWL = powerW / safeVolumeL;
    // --- Fim dos Cálculos ---

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{cell.Brand || "Unknown"} {cell.CellModelNo}</DialogTitle>
                    <DialogDescription>{cell.Composition}</DialogDescription>
                </DialogHeader>

                <div className="py-4 max-h-[70vh] overflow-y-auto">
                    <Card>
                        <CardContent className="pt-6 text-sm space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                {/* Coluna 1 */}
                                <div className="space-y-2">
                                    <p><strong>Capacity:</strong> {(cell.Capacity / 1000).toFixed(2)} Ah</p>
                                    <p><strong>Nominal Voltage:</strong> {cell.NominalVoltage.toFixed(1)} V</p>
                                    <p><strong>Weight:</strong> {cell.Weight} g</p>
                                    <p><strong>Dimensions:</strong> {cell.Cell_Height}H x {cell.Cell_Width}W x {cell.Cell_Thickness}T mm</p>
                                    <p><strong>Cycles:</strong> {cell.Cycles}</p>
                                    <p><strong>Impedance:</strong> {cell.Impedance} mΩ</p>
                                </div>

                                {/* Coluna 2 */}
                                <div className="space-y-2">
                                    <p><strong>Energy:</strong> {energyWh.toFixed(2)} Wh</p>
                                    <p><strong>Continuous Power:</strong> {powerW.toFixed(2)} W</p>
                                    <p><strong>Volume:</strong> {volumeCm3.toFixed(1)} cm³ ({volumeL.toFixed(3)} L)</p>
                                    <p><strong>Energy Density:</strong> {energyDensityWhL.toFixed(1)} Wh/L</p>
                                    <p><strong>Power Density:</strong> {powerDensityWL.toFixed(1)} W/L</p>
                                    <p><strong>Discharge/Charge:</strong> {cell.MaxContinuousDischargeRate}C / {cell.MaxContinuousChargeRate}C</p>
                                </div>

                                {/* Link + Botão */}
                                <div className="pt-4 mt-4 border-t md:col-span-2">
                                    <AffiliateLink link={cell.Connection} />
                                    <Button
                                        className="w-full mt-3"
                                        onClick={() => toast({ title: "Not Implemented", description: "Feature coming soon." })}
                                    >
                                        Get Data
                                    </Button>
                                </div>
                            </div> {/* ✅ fecha a grid */}
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );

}
export default CellExplorer;