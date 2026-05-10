import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
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

interface Cell {
    Brand: string;
    CellModelNo: string;
    Composition: string;
    Cell_Stack: string;
    MaxContinuousDischargeRate: number;
    MaxContinuousChargeRate: number;
    NominalVoltage: number;
    ChargeVoltage: number;
    Capacity: number;
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

const CELLS_PER_PAGE = 21;

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

const getEnergy = (c: Cell) => (c.Capacity / 1000) * c.NominalVoltage;
const getPower = (c: Cell) => getEnergy(c) * c.MaxContinuousDischargeRate;
const getDensity = (c: Cell) => {
    const energy = getEnergy(c);
    const volumeL = (c.Cell_Height * c.Cell_Width * c.Cell_Thickness) / 1_000_000;
    return volumeL > 0 ? energy / volumeL : 0;
};

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
    return parts.length > 1 ? parts[1] : stack;
};

const CellExplorer = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [allCells, setAllCells] = useState<Cell[]>([]);
    const [filteredCells, setFilteredCells] = useState<Cell[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const { toast } = useToast();

    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
    const [filterBoundaries, setFilterBoundaries] = useState<FilterBoundaries | null>(null);
    const [filterValues, setFilterValues] = useState<FilterValues | null>(null);

    const [activeTab, setActiveTab] = useState("chart");
    const [xAxis, setXAxis] = useState("energyDensityWhL");
    const [yAxis, setYAxis] = useState("energyWh");
    const [sortParam, setSortParam] = useState("capacity");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [formatCounts, setFormatCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        document.title = `${t('explorer.pageTitle')} | Watt Builder`;
    }, [t]);

    useEffect(() => {
        const fetchCellCatalogue = async () => {
            setIsLoading(true);
            try {
                const url = getApiUrl("cells");
                const res = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (!res.ok) throw new Error(`Failed to fetch (status: ${res.status})`);

                const data: Cell[] = await res.json();

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
                    if (count > 0) {
                        const trimmedFmt = fmt.trim();
                        const displayFmt = /^\d/.test(trimmedFmt) ? `${t('explorer.cylindricalPrefix')} - ${trimmedFmt}` : trimmedFmt;
                        cellStackOptions.add(displayFmt);
                    }
                });

                const getOptions = (key: keyof Cell) => [
                    ...new Set(data.map(c => c[key] as string).filter(Boolean))
                ].sort();

                const sortCellStacks = (a: string, b: string) => {
                    const aTrimmed = a.trim();
                    const bTrimmed = b.trim();
                    const aIsCylindrical = aTrimmed.startsWith(t('explorer.cylindricalPrefix'));
                    const bIsCylindrical = bTrimmed.startsWith(t('explorer.cylindricalPrefix'));

                    if (aIsCylindrical !== bIsCylindrical) return aIsCylindrical ? 1 : -1;

                    if (aIsCylindrical) {
                        const aNum = parseInt(aTrimmed.replace(`${t('explorer.cylindricalPrefix')} - `, ""));
                        const bNum = parseInt(bTrimmed.replace(`${t('explorer.cylindricalPrefix')} - `, ""));
                        return aNum - bNum;
                    }

                    return aTrimmed.localeCompare(bTrimmed, undefined, { numeric: true, sensitivity: "base" });
                };

                const options: FilterOptions = {
                    brands: getOptions('Brand'),
                    chemistries: getOptions('Composition'),
                    cellStacks: Array.from(cellStackOptions).sort(sortCellStacks),
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
                toast({ title: t('explorer.toasts.errorFetching'), description: error.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchCellCatalogue();
    }, [toast, t]);

    useEffect(() => {
        if (!filterValues || allCells.length === 0) return;
        const query = filterValues.searchQuery.toLowerCase();

        const cells = allCells.filter(cell => {
            if (query && !cell.CellModelNo.toLowerCase().includes(query) && !cell.Brand.toLowerCase().includes(query)) return false;
            if (filterValues.brand.length > 0 && !filterValues.brand.includes(cell.Brand)) return false;
            if (filterValues.chemistry.length > 0 && !filterValues.chemistry.includes(cell.Composition)) return false;

            if (filterValues.cellStack.length > 0) {
                const rawFormat = getFormatFromStack(cell.Cell_Stack);
                const trimmedFormat = rawFormat.trim();
                const selectedFormat = /^\d/.test(trimmedFormat) ? `${t('explorer.cylindricalPrefix')} - ${trimmedFormat}` : trimmedFormat;
                if (!filterValues.cellStack.includes(selectedFormat)) return false;
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
    }, [allCells, filterValues, sortParam, sortOrder, t]);

    const pageCount = Math.ceil(filteredCells.length / CELLS_PER_PAGE);
    const paginatedCells = useMemo(() => {
        const startIndex = (currentPage - 1) * CELLS_PER_PAGE;
        const endIndex = startIndex + CELLS_PER_PAGE;
        return filteredCells.slice(startIndex, endIndex);
    }, [filteredCells, currentPage]);

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

    const formatAxisLabel = (key: string) => {
        switch (key) {
            case "capacityAh": return t('explorer.chart.capacity');
            case "NominalVoltage": return t('explorer.chart.nominalVoltage');
            case "Weight": return t('explorer.chart.weight');
            case "MaxContinuousDischargeRate": return t('explorer.chart.dischargeRate');
            case "MaxContinuousChargeRate": return t('explorer.chart.chargeRate');
            case "Impedance": return t('explorer.chart.impedance');
            case "Cycles": return t('explorer.chart.cycles');
            case "energyWh": return t('explorer.chart.energy');
            case "powerW": return t('explorer.chart.power');
            case "volumeL": return t('explorer.chart.volume');
            case "energyDensityWhL": return t('explorer.chart.energyDensityWhL');
            case "powerDensityWL": return t('explorer.chart.powerDensityWL');
            case "energyDensityWhKg": return t('explorer.chart.energyDensityWhKg');
            case "powerDensityWKg": return t('explorer.chart.powerDensityWKg');
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
            const energyDensityWhKg = energyWh / (cell.Weight / 1000);
            const powerDensityWKg = powerW / (cell.Weight / 1000);

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
            return Object.assign({}, cell, computed) as ChartCellData;
        });
    }, [filteredCells]);

    const chartAxisOptions = [
        { value: "capacityAh", label: t('explorer.chart.capacity') },
        { value: "Weight", label: t('explorer.chart.weight') },
        { value: "MaxContinuousDischargeRate", label: t('explorer.chart.dischargeRate') },
        { value: "MaxContinuousChargeRate", label: t('explorer.chart.chargeRate') },
        { value: "Impedance", label: t('explorer.chart.impedance') },
        { value: "Cycles", label: t('explorer.chart.cycles') },
        { value: "energyWh", label: t('explorer.chart.energy') },
        { value: "powerW", label: t('explorer.chart.power') },
        { value: "volumeL", label: t('explorer.chart.volume') },
        { value: "energyDensityWhL", label: t('explorer.chart.energyDensityWhL') },
        { value: "powerDensityWL", label: t('explorer.chart.powerDensityWL') },
        { value: "energyDensityWhKg", label: t('explorer.chart.energyDensityWhKg') },
        { value: "powerDensityWKg", label: t('explorer.chart.powerDensityWKg') },
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
        filterOptions?.chemistries.forEach(comp => {
            if (!colors[comp]) {
                colors[comp] = baseColors[colorIndex % baseColors.length];
                colorIndex++;
            }
        });
        return colors;
    }, [filterOptions]);

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

    return (
        <div className="min-h-screen flex flex-col" id="cell-explorer-top">
            <Navigation />

            <section className="py-24 bg-background">
                <div className="container px-4 mx-auto max-w-7xl">

                    <div className="text-center mb-12 animate-slide-up">
                        <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                            {t('explorer.title')}
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            {t('explorer.subtitle')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 lg:gap-8">

                        <aside className="lg:col-span-1">
                            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
                                <Card className="shadow-soft mb-12 lg:mb-0">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle>{t('explorer.filters.title')}</CardTitle>
                                        <Button variant="outline" size="icon" onClick={resetFilters}>
                                            <RefreshCw className="w-4 h-4" />
                                            <span className="sr-only">{t('explorer.filters.reset')}</span>
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <div className="grid grid-cols-1 gap-y-4">

                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="search">{t('explorer.filters.search')}</Label>
                                                    <Input id="search" placeholder={t('explorer.filters.searchPlaceholder')}
                                                        value={filterValues.searchQuery}
                                                        onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>{t('explorer.filters.brand')}</Label>
                                                    <MultiSelect
                                                        options={filterOptions.brands}
                                                        selected={filterValues.brand}
                                                        onChange={(v) => handleFilterChange('brand', v)}
                                                        placeholder={t('explorer.filters.brandPlaceholder')}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>{t('explorer.filters.chemistry')}</Label>
                                                    <MultiSelect
                                                        options={filterOptions.chemistries}
                                                        selected={filterValues.chemistry}
                                                        onChange={(v) => handleFilterChange('chemistry', v)}
                                                        placeholder={t('explorer.filters.chemistryPlaceholder')}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>{t('explorer.filters.cellFormat')}</Label>
                                                    <MultiSelect
                                                        options={filterOptions.cellStacks}
                                                        selected={filterValues.cellStack}
                                                        onChange={(v) => handleFilterChange('cellStack', v)}
                                                        placeholder={t('explorer.filters.formatPlaceholder')}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-4 pt-2">
                                                <RangeSliderFilter
                                                    label={t('explorer.filters.sliders.capacity')} unit="mAh"
                                                    min={filterBoundaries.capacity[0]}
                                                    max={filterBoundaries.capacity[1]}
                                                    value={filterValues.capacity}
                                                    step={1000}
                                                    onChange={(v) => handleFilterChange('capacity', v)}
                                                />
                                                <RangeSliderFilter
                                                    label={t('explorer.filters.sliders.weight')} unit="g"
                                                    min={filterBoundaries.weight[0]}
                                                    max={filterBoundaries.weight[1]}
                                                    value={filterValues.weight}
                                                    step={50}
                                                    onChange={(v) => handleFilterChange('weight', v)}
                                                />
                                            </div>

                                            <div className="space-y-4 pt-2">
                                                <RangeSliderFilter
                                                    label={t('explorer.filters.sliders.dischargeRate')} unit="C"
                                                    min={filterBoundaries.dischargeRate[0]}
                                                    max={filterBoundaries.dischargeRate[1]}
                                                    value={filterValues.dischargeRate}
                                                    step={0.5}
                                                    onChange={(v) => handleFilterChange('dischargeRate', v)}
                                                />
                                                <RangeSliderFilter
                                                    label={t('explorer.filters.sliders.chargeRate')} unit="C"
                                                    min={filterBoundaries.chargeRate[0]}
                                                    max={filterBoundaries.chargeRate[1]}
                                                    value={filterValues.chargeRate}
                                                    step={0.5}
                                                    onChange={(v) => handleFilterChange('chargeRate', v)}
                                                />
                                                <RangeSliderFilter
                                                    label={t('explorer.filters.sliders.impedance')} unit="mΩ"
                                                    min={filterBoundaries.impedance[0]}
                                                    max={filterBoundaries.impedance[1]}
                                                    value={filterValues.impedance}
                                                    step={0.1}
                                                    onChange={(v) => handleFilterChange('impedance', v)}
                                                />
                                                <RangeSliderFilter
                                                    label={t('explorer.filters.sliders.cycles')} unit=""
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

                        <main className="lg:col-span-3">
                            {filteredCells.length > 0 ? (
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <div className="flex justify-between items-center mb-6">
                                        <TabsList className="grid w-full grid-cols-2 max-w-xs">
                                            <TabsTrigger value="chart">
                                                <BarChart3 className="w-4 h-4 mr-2" />
                                                {t('explorer.tabs.chart')}
                                            </TabsTrigger>
                                            <TabsTrigger value="grid">
                                                <LayoutGrid className="w-4 h-4 mr-2" />
                                                {t('explorer.tabs.grid')}
                                            </TabsTrigger>
                                        </TabsList>
                                        {activeTab === 'grid' && (
                                            <div className="flex items-center gap-2 w-full md:w-auto animate-fade-in">
                                                <Label className="text-sm text-muted-foreground whitespace-nowrap">{t('explorer.tabs.sortBy')}</Label>
                                                <div className="flex items-center gap-1">
                                                    <Select value={sortParam} onValueChange={setSortParam}>
                                                        <SelectTrigger className="h-9 w-[180px] bg-background">
                                                            <SelectValue placeholder="Parameter" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="capacity">{t('explorer.tabs.sortOpts.capacity')}</SelectItem>
                                                            <SelectItem value="energy">{t('explorer.tabs.sortOpts.energy')}</SelectItem>
                                                            <SelectItem value="power">{t('explorer.tabs.sortOpts.power')}</SelectItem>
                                                            <SelectItem value="weight">{t('explorer.tabs.sortOpts.weight')}</SelectItem>
                                                            <SelectItem value="density">{t('explorer.tabs.sortOpts.density')}</SelectItem>
                                                            <SelectItem value="energyDensityWhKg">{t('explorer.tabs.sortOpts.gravDensity')}</SelectItem>
                                                            <SelectItem value="powerDensityWKg">{t('explorer.tabs.sortOpts.gravPower')}</SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-9 w-9"
                                                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                                        title={sortOrder === 'asc' ? t('explorer.tabs.asc') : t('explorer.tabs.desc')}
                                                    >
                                                        {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        <p className="text-sm text-muted-foreground hidden lg:block">
                                            {t('explorer.tabs.foundCells', { count: filteredCells.length })}
                                            {activeTab === 'grid' && ` (${t('explorer.tabs.showingCells', { count: paginatedCells.length })})`}
                                        </p>
                                    </div>

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
                                                            <CardDescription>{cell.Brand || t('explorer.unknown')} - {cell.Composition}</CardDescription>
                                                        </CardHeader>
                                                        <CardContent className="text-sm space-y-2">
                                                            <p><strong>{t('explorer.gridCard.capacity')}</strong> {(cell.Capacity / 1000).toFixed(1)} Ah</p>
                                                            <p><strong>{t('explorer.gridCard.voltage')}</strong> {cell.NominalVoltage.toFixed(1)} V</p>
                                                            <p><strong>{t('explorer.gridCard.energyDensity')}</strong> {(getEnergy(cell) / (cell.Weight / 1000)).toFixed(1)} Wh/kg</p>
                                                            <p><strong>{t('explorer.gridCard.weight')}</strong> {cell.Weight} g</p>
                                                            <p><strong>{t('explorer.gridCard.dischargeRate')}</strong> {cell.MaxContinuousDischargeRate} C</p>
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

                                    <TabsContent value="chart">
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>{t('explorer.chart.xAxis')}</Label>
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
                                                    <Label>{t('explorer.chart.yAxis')}</Label>
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
                                                            {filterOptions.chemistries.map(chemistry => (
                                                                <Scatter
                                                                    key={chemistry}
                                                                    name={chemistry}
                                                                    data={chartData.filter(cell => cell.Composition === chemistry)}
                                                                    fill={chemistryColors[chemistry] || "hsl(var(--muted))"}
                                                                    fillOpacity={0.7}
                                                                    onClick={(data) => {
                                                                        const slug = createCellSlug(data.payload.Brand, data.payload.CellModelNo);
                                                                        window.location.href = `/cell/${slug}`;
                                                                    }}
                                                                    shape={(props: any) => {
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
                                    <h3 className="text-2xl font-semibold mb-2">{t('explorer.noCellsTitle')}</h3>
                                    <p className="text-muted-foreground">
                                        {t('explorer.noCellsDesc')}
                                    </p>
                                </div>
                            )}
                        </main>

                    </div>
                </div>
            </section>

            <section className="py-24 bg-muted/30">
                <div className="container px-4 mx-auto max-w-5xl text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full text-accent font-medium mb-6">
                        <Microscope size={18} />
                        <span>{t('explorer.testing.badge')}</span>
                    </div>
                    <h2 className="text-4xl font-bold text-foreground mb-6">
                        {t('explorer.testing.title')}
                    </h2>
                    <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
                        {t('explorer.testing.desc')}
                    </p>

                    <div className="grid md:grid-cols-3 gap-8 mb-12 text-left">
                        <Card className="bg-background border-border shadow-sm">
                            <CardHeader>
                                <FlaskConical className="w-10 h-10 text-accent mb-4" />
                                <CardTitle>{t('explorer.testing.perfTitle')}</CardTitle>
                                <CardDescription>
                                    {t('explorer.testing.perfDesc')}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="bg-background border-border shadow-sm">
                            <CardHeader>
                                <ClipboardCheck className="w-10 h-10 text-accent mb-4" />
                                <CardTitle>{t('explorer.testing.cycleTitle')}</CardTitle>
                                <CardDescription>
                                    {t('explorer.testing.cycleDesc')}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="bg-background border-border shadow-sm">
                            <CardHeader>
                                <BarChart3 className="w-10 h-10 text-accent mb-4" />
                                <CardTitle>{t('explorer.testing.thermalTitle')}</CardTitle>
                                <CardDescription>
                                    {t('explorer.testing.thermalDesc')}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>

                    <Button size="lg" className="text-lg px-8 py-6 h-auto" onClick={() => navigate("/contact")}>
                        {t('explorer.testing.contactBtn')}
                    </Button>
                </div>
            </section>
            <Footer />
        </div >
    );
};

export default CellExplorer;