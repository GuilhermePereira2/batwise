import { useState, useEffect, useMemo } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Link } from "react-router-dom";
import { createCellSlug } from "@/lib/utils";

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
import { Search, Loader2, Database, X, ExternalLink, RefreshCw, LayoutGrid, BarChart3, Microscope, FlaskConical, ClipboardCheck, ArrowUp, ArrowDown, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getApiUrl } from "@/lib/config";
import { useNavigate } from "react-router-dom";
import { MultiSelect } from "@/components/ui/multi-select";

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
    dischargeRate: [number, number];
    chargeRate: [number, number];
    impedance: [number, number];
    cycles: [number, number];
}
// Renamed to 'chemistry'
interface FilterValues {
    searchQuery: string;
    brand: string[];
    chemistry: string[];
    cellStack: string[];
    capacity: [number, number];
    weight: [number, number];
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

// Helpers de cálculo para ordenação
const getEnergy = (c: Cell) => (c.Capacity / 1000) * c.NominalVoltage;
const getPower = (c: Cell) => getEnergy(c) * c.MaxContinuousDischargeRate;
const getDensity = (c: Cell) => {
    const energy = getEnergy(c);
    const volumeL = (c.Cell_Height * c.Cell_Width * c.Cell_Thickness) / 1_000_000;
    return volumeL > 0 ? energy / volumeL : 0;
};

// Helper Component: Chart Legend
const ChartLegend = ({ colors }: { colors: { [key: string]: string } }) => {
    return (
        <div className="flex flex-wrap justify-center gap-4 mt-4 p-4 bg-muted/20 rounded-lg border border-border/50">
            {Object.entries(colors).map(([chemistry, color]) => (
                <div key={chemistry} className="flex items-center gap-2">
                    <span
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                        {chemistry}
                    </span>
                </div>
            ))}
        </div>
    );
};

const getFormatFromStack = (stack: string) => {
    if (!stack) return "Unknown";
    const parts = stack.split('-');
    // Retorna a parte depois do hifen, ou a string original se não houver hifen
    return parts.length > 1 ? parts[1] : stack;
};

// --- Main Component ---
const CellExplorer = () => {
    const navigate = useNavigate();
    const [allCells, setAllCells] = useState<Cell[]>([]);
    const [filteredCells, setFilteredCells] = useState<Cell[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    // const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const { toast } = useToast();

    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
    const [filterBoundaries, setFilterBoundaries] = useState<FilterBoundaries | null>(null);
    const [filterValues, setFilterValues] = useState<FilterValues | null>(null);

    const [activeTab, setActiveTab] = useState("chart");
    const [xAxis, setXAxis] = useState("energyDensityWhL");
    const [yAxis, setYAxis] = useState("energyWh");
    const [sortParam, setSortParam] = useState("capacity"); // Parâmetro
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [formatCounts, setFormatCounts] = useState<Record<string, number>>({});

    // Set browser tab title
    useEffect(() => {
        document.title = "Cell Explorer | Watt Builder";
    }, []);

    // Fetch data from API
    useEffect(() => {
        const fetchCellCatalogue = async () => {
            setIsLoading(true);
            try {
                const url = getApiUrl("cells");
                console.log(`📡 A conectar a: ${url}`);

                const res = await fetch(url, { // <--- Usa a variável url aqui
                    method: 'GET',
                    headers: {
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

                const counts: Record<string, number> = {};
                data.forEach(cell => {
                    const fmt = getFormatFromStack(cell.Cell_Stack);
                    counts[fmt] = (counts[fmt] || 0) + 1;
                });
                setFormatCounts(counts);

                const cellStackOptions = new Set<string>();
                Object.entries(counts).forEach(([fmt, count]) => {
                    if (count > 5) {
                        cellStackOptions.add(fmt);
                    } else {
                        cellStackOptions.add("Cylindrical");
                    }
                });

                const getOptions = (key: keyof Cell) => [
                    ...new Set(data.map(c => c[key] as string).filter(Boolean))
                ].sort();

                const options: FilterOptions = {
                    brands: getOptions('Brand'),
                    chemistries: getOptions('Composition'), // Data key 'Composition' maps to state 'chemistries'
                    cellStacks: Array.from(cellStackOptions).sort(),
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
                    dischargeRate: getMinMax('MaxContinuousDischargeRate'),
                    chargeRate: getMinMax('MaxContinuousChargeRate'),
                    impedance: getMinMax('Impedance'),
                    cycles: getMinMax('Cycles'),
                };
                setFilterBoundaries(boundaries);

                setFilterValues({
                    searchQuery: "",
                    brand: [],
                    chemistry: [],
                    cellStack: [],
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
            if (filterValues.brand.length > 0 && !filterValues.brand.includes(cell.Brand)) return false;

            if (filterValues.chemistry.length > 0 && !filterValues.chemistry.includes(cell.Composition)) return false;

            if (filterValues.cellStack.length > 0) {
                const rawFormat = getFormatFromStack(cell.Cell_Stack);
                // Se a contagem deste formato for <= 5, ele é considerado "Others"
                const category = (formatCounts[rawFormat] || 0) > 5 ? rawFormat : "Cylindrical";
                if (!filterValues.cellStack.includes(category)) return false;
            }
            if (cell.Capacity < filterValues.capacity[0] || cell.Capacity > filterValues.capacity[1]) return false;
            if (cell.Weight < filterValues.weight[0] || cell.Weight > filterValues.weight[1]) return false;
            if (cell.MaxContinuousDischargeRate < filterValues.dischargeRate[0] || cell.MaxContinuousDischargeRate > filterValues.dischargeRate[1]) return false;
            if (cell.MaxContinuousChargeRate < filterValues.chargeRate[0] || cell.MaxContinuousChargeRate > filterValues.chargeRate[1]) return false;
            if (cell.Impedance < filterValues.impedance[0] || cell.Impedance > filterValues.impedance[1]) return false;
            if (cell.Cycles < filterValues.cycles[0] || cell.Cycles > filterValues.cycles[1]) return false;
            return true;
        });
        cells.sort((a, b) => {
            const getValue = (c: Cell) => {
                switch (sortParam) {
                    case "energy": return getEnergy(c);
                    case "power": return getPower(c);
                    case "weight": return c.Weight;
                    case "density": return getDensity(c);
                    case "capacity": return c.Capacity;
                    case "energyDensityWhKg": return c.Weight > 0 ? getEnergy(c) / c.Weight : 0;
                    case "powerDensityWKg": return c.Weight > 0 ? getPower(c) / c.Weight : 0;
                    default: return 0;
                }
            };

            const valA = getValue(a);
            const valB = getValue(b);

            return sortOrder === 'asc' ? valA - valB : valB - valA;
        });
        setFilteredCells(cells);
        setCurrentPage(1);
    }, [allCells, filterValues, sortParam, sortOrder]);

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
                brand: [],
                chemistry: [],
                cellStack: [],
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
            case "energyDensityWhKg": return "Energy Density (Wh/Kg)";
            case "powerDensityWKg": return "Power Density (W/Kg)";
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
            const energyDensityWhKg = energyWh / (cell.Weight / 1000000);
            const powerDensityWKg = powerW / (cell.Weight / 1000000);

            // Create computed values object
            const computed = {
                capacityAh,
                energyWh,
                powerW,
                volumeL,
                energyDensityWhL,
                powerDensityWL,
                energyDensityWhKg,
                powerDensityWKg,
            };

            // Merge cell data with computed values for chart
            // Using Object.assign to create a new object without spread
            return Object.assign({}, cell, computed) as ChartCellData;
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
        { value: "energyDensityWhKg", label: "Energy Density (Wh/Kg)" },
        { value: "powerDensityWKg", label: "Power Density (W/Kg)" },
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
                                                    <MultiSelect
                                                        options={filterOptions.brands}
                                                        selected={filterValues.brand}
                                                        onChange={(v) => handleFilterChange('brand', v)}
                                                        placeholder="Select Brands"
                                                    />
                                                </div>
                                                {/* Chemistry Filter */}
                                                <div className="space-y-2">
                                                    <Label>Chemistry</Label>
                                                    <MultiSelect
                                                        options={filterOptions.chemistries}
                                                        selected={filterValues.chemistry}
                                                        onChange={(v) => handleFilterChange('chemistry', v)}
                                                        placeholder="Select Chemistries"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Cell Format</Label>
                                                    <MultiSelect
                                                        options={filterOptions.cellStacks}
                                                        selected={filterValues.cellStack}
                                                        onChange={(v) => handleFilterChange('cellStack', v)}
                                                        placeholder="Select Formats"
                                                    />
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
                                        {/* --- ADIÇÃO: Seletor de Ordenação --- */}
                                        {activeTab === 'grid' && (
                                            <div className="flex items-center gap-2 w-full md:w-auto animate-fade-in">
                                                <Label className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</Label>
                                                <div className="flex items-center gap-1">
                                                    <Select value={sortParam} onValueChange={setSortParam}>
                                                        <SelectTrigger className="h-9 w-[180px] bg-background">
                                                            <SelectValue placeholder="Parameter" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="capacity">Capacity (Ah)</SelectItem>
                                                            <SelectItem value="energy">Energy (Wh)</SelectItem>
                                                            <SelectItem value="power">Power (W)</SelectItem>
                                                            <SelectItem value="weight">Weight (g)</SelectItem>
                                                            <SelectItem value="density">Vol. Density (Wh/L)</SelectItem>
                                                            <SelectItem value="energyDensityWhKg">Grav. Density (Wh/Kg)</SelectItem>
                                                            <SelectItem value="powerDensityWKg">Grav. Power (W/Kg)</SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-9 w-9"
                                                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                                        title={sortOrder === 'asc' ? "Ascending" : "Descending"}
                                                    >
                                                        {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        <p className="text-sm text-muted-foreground hidden lg:block">
                                            Found {filteredCells.length} matching cells
                                            {activeTab === 'grid' && ` (showing ${paginatedCells.length})`}
                                        </p>
                                    </div>

                                    {/* TAB 1: GRID VIEW */}
                                    <TabsContent value="grid">
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {paginatedCells.map((cell, index) => (
                                                <Link
                                                    key={`${cell.Brand}-${cell.CellModelNo}-${index}`}
                                                    to={`/cell/${createCellSlug(cell.Brand, cell.CellModelNo)}`}
                                                    className="block h-full"
                                                >
                                                    <Card className="h-full shadow-soft hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer">
                                                        <CardHeader>
                                                            <CardTitle className="text-lg">{cell.CellModelNo}</CardTitle>
                                                            <CardDescription>{cell.Brand || "Unknown"} - {cell.Composition}</CardDescription>
                                                        </CardHeader>
                                                        <CardContent className="text-sm space-y-2">
                                                            <p><strong>Capacity:</strong> {(cell.Capacity / 1000).toFixed(1)} Ah</p>
                                                            <p><strong>Voltage:</strong> {cell.NominalVoltage.toFixed(1)} V</p>
                                                            <p><strong>Energy Density:</strong> {(getEnergy(cell) / (cell.Weight / 1000)).toFixed(1)} Wh/kg</p>
                                                            <p><strong>Weight:</strong> {cell.Weight} g</p>
                                                            <p><strong>Discharge Rate:</strong> {cell.MaxContinuousDischargeRate} C</p>
                                                        </CardContent>
                                                    </Card>
                                                </Link>
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
                                                                    if (xAxis === "energyDensityWhKg") return `${value.toFixed(1)} Wh/kg`;
                                                                    if (xAxis === "powerDensityWKg") return `${value.toFixed(1)} W/kg`;
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
                                                                    if (yAxis === "energyDensityWhKg") return `${value.toFixed(1)} Wh/kg`;
                                                                    if (yAxis === "powerDensityWKg") return `${value.toFixed(1)} W/kg`;
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
                                                                    data={chartData.filter(cell => cell.Composition === chemistry)}
                                                                    fill={chemistryColors[chemistry] || "hsl(var(--muted))"}
                                                                    fillOpacity={0.7}
                                                                    // AQUI: Ao clicar na bola, abre a página nova
                                                                    onClick={(data) => {
                                                                        const slug = createCellSlug(data.payload.Brand, data.payload.CellModelNo);
                                                                        window.location.href = `/cell/${slug}`; // Usando window location para simplificar dentro do recharts
                                                                    }}
                                                                    shape={(props: any) => {
                                                                        // Only pass valid SVG circle props to avoid React warnings
                                                                        const { cx, cy, fill, fillOpacity, stroke, strokeWidth } = props;
                                                                        return (
                                                                            <circle
                                                                                cx={cx}
                                                                                cy={cy}
                                                                                r={5}
                                                                                fill={fill}
                                                                                fillOpacity={fillOpacity}
                                                                                stroke={stroke}
                                                                                strokeWidth={strokeWidth}
                                                                                style={{ cursor: 'pointer' }}
                                                                            />
                                                                        );
                                                                    }}
                                                                />
                                                            ))}
                                                        </ScatterChart>
                                                    </ResponsiveContainer>
                                                </ChartContainer>
                                                <ChartLegend colors={chemistryColors} />
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
            </section>
            {/* Nova Secção: Serviços de Teste de Células */}

            <section className="py-24 bg-muted/30">
                <div className="container px-4 mx-auto max-w-5xl text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full text-accent font-medium mb-6">
                        <Microscope size={18} />
                        <span>Professional Cell Testing</span>
                    </div>
                    <h2 className="text-4xl font-bold text-foreground mb-6">
                        Need Comprehensive Cell Data?
                    </h2>
                    <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
                        We have state-of-the-art equipment to perform a wide variety of tests on battery cells.
                        From capacity verification to rigorous stress testing, we handle everything for you.
                    </p>

                    <div className="grid md:grid-cols-3 gap-8 mb-12 text-left">
                        <Card className="bg-background border-border shadow-sm">
                            <CardHeader>
                                <FlaskConical className="w-10 h-10 text-accent mb-4" />
                                <CardTitle>Performance Verification</CardTitle>
                                <CardDescription>
                                    Verify capacity, voltage curves, and internal resistance with high precision equipment.
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

                    <Button size="lg" className="text-lg px-8 py-6 h-auto" onClick={() => navigate("/contact")}>
                        Contact Us for Custom Testing
                    </Button>
                </div>
            </section>
            <Footer />
        </div >
    );
};


// --- Modal de Detalhe da Célula (sem alteração) ---
const CellDetailModal = ({ cell, isOpen, onClose }: { cell: Cell, isOpen: boolean, onClose: () => void }) => {
    const { toast } = useToast();
    const navigate = useNavigate();

    const AffiliateLink = ({ link }: { link?: string }) => {
        if (!link || link === "Solder" || link === "") return null;
        return (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1 mt-1">
                Buy from Affiliate <ExternalLink className="inline w-3 h-3" />
            </a>
        );
    };

    const handleGetData = () => {
        const cellName = `${cell.Brand || "Unknown"} ${cell.CellModelNo}`;
        const messageTemplate = `Hello,\nI would like to get the following data about the ${cellName} cell:\n\n\nBest regards,\n`;

        // Codifica a mensagem para ser segura num URL
        const encodedMessage = encodeURIComponent(messageTemplate);

        // Redireciona para a página de contacto com o parâmetro 'message'
        navigate(`/contact?message=${encodedMessage}`);
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
    const energyDensityWhKg = energyWh / (cell.Weight / 1000000);
    const powerDensityWKg = powerW / (cell.Weight / 1000000);
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
                                    <p><strong>Energy Density:</strong> {energyDensityWhKg.toFixed(1)} Wh/kg</p>
                                    <p><strong>Power Density:</strong> {powerDensityWKg.toFixed(1)} W/kg</p>
                                    <p><strong>Continuous Discharge/Charge Rate:</strong> {cell.MaxContinuousDischargeRate}C / {cell.MaxContinuousChargeRate}C</p>
                                </div>

                                {/* Link + Botão */}
                                <div className="pt-4 mt-4 border-t md:col-span-2">
                                    <AffiliateLink link={cell.Connection} />
                                    <Button
                                        className="w-full mt-3"
                                        onClick={handleGetData} // Altera de toast para a nova função
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