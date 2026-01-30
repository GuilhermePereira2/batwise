import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Battery, Zap, Calculator, Sparkles, Loader2, ExternalLink, AlertTriangle, CheckCircle, CircuitBoard, ChevronDown, ChevronUp, Upload, FileDown, Database, FileSpreadsheet, FileText, DollarSign, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartTooltip } from "@/components/ui/chart";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { WiringDiagram } from "@/components/WiringDiagram";
import { getApiUrl } from "@/lib/config";
import { Checkbox } from "@/components/ui/checkbox";

// --- IMPORTS CUSTOMIZADOS ---
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { USE_CASES } from "@/lib/presets";
// ----------------------------

// --- TIPAGEM LOCAL ---
interface SafetyAssessment {
  is_safe: boolean;
  safety_score: number;
  warnings: string[];
  recommendations: string[];
}

interface ComponentData {
  brand: string;
  model: string;
  price: number;
  link?: string;
  vdc_max?: number;
  a_max?: number;
  master_price?: number;
  slave_price?: number; // Adicionado para compatibilidade com BMS
  section?: number;
  max_cells?: number;
}

interface Configuration {
  cell: {
    Brand: string;
    CellModelNo: string;
    NominalVoltage: number;
    MaxContinuousDischargeRate: number;
    MaxContinuousChargeRate: number;
    Cell_Height: number;
    Cell_Width: number;
    Cell_Thickness: number;
    Weight: number;
    Price: number;
    Connection: string;
    Capacity: number;
  };
  series_cells: number;
  parallel_cells: number;
  battery_voltage: number;
  battery_capacity: number;
  battery_energy: number;
  battery_weight: number;
  continuous_power: number;
  peak_power: number;
  total_price: number;
  safety: SafetyAssessment;
  fuse?: ComponentData;
  relay?: ComponentData;
  bms?: ComponentData;
  shunt?: ComponentData;
  cable?: ComponentData;
}

// Helper function to format W/Wh to kW/kWh
const formatUnit = (value: number, unit: 'W' | 'Wh') => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} k${unit}`;
  }
  return `${value.toFixed(0)} ${unit}`;
};

// Função auxiliar para encontrar melhores configs
const findBestConfigurations = (configs: Configuration[], targetPrice: number) => {
  if (!configs.length) return [];

  const findBest = (metric: (c: Configuration) => number, compare: 'min' | 'max' = 'max') => {
    return configs.reduce((best, current) => {
      const bestMetric = metric(best);
      const currentMetric = metric(current);
      return (compare === 'max' ? currentMetric > bestMetric : currentMetric < bestMetric) ? current : best;
    });
  };

  const calculateOptimalScore = (config: Configuration) => {
    if (!config.safety.is_safe) return 0;
    const energyDensity = config.battery_energy / config.battery_weight;
    const maxEnergyDensity = Math.max(...configs.map(c => c.battery_energy / c.battery_weight));
    const normalizedDensity = energyDensity / maxEnergyDensity;
    const priceDifference = Math.abs(config.total_price - targetPrice);
    const maxPriceDiff = Math.max(...configs.map(c => Math.abs(c.total_price - targetPrice)));
    const normalizedPrice = 1 - (priceDifference / maxPriceDiff);
    return (normalizedDensity + normalizedPrice + (config.safety.safety_score / 100)) / 3;
  };

  return [
    { title: "Lowest Price", config: findBest(c => c.total_price, 'min'), metric: (c: Configuration) => `$${c.total_price.toFixed(2)}` },
    { title: "Highest Energy", config: findBest(c => c.battery_energy), metric: (c: Configuration) => formatUnit(c.battery_energy, 'Wh') },
    { title: "Highest Energy Density", config: findBest(c => c.battery_energy / c.battery_weight), metric: (c: Configuration) => `${(c.battery_energy / c.battery_weight).toFixed(1)} Wh/kg` },
    { title: "Best Value", config: findBest(c => c.total_price / c.battery_energy), metric: (c: Configuration) => `${(c.total_price / c.battery_energy).toFixed(1)} $/Wh` },
    { title: "Lightest", config: findBest(c => c.battery_weight, 'min'), metric: (c: Configuration) => `${c.battery_weight.toFixed(1)} kg` },
    { title: "Optimal Balance", config: findBest(c => calculateOptimalScore(c)), metric: (c: Configuration) => `${(c.battery_energy / c.battery_weight).toFixed(1)} Wh/kg @ $${c.total_price.toFixed(0)}` }
  ];
};

// --- HELPER PARA DOWNLOAD DE TEMPLATES CSV ---
const downloadCsvTemplate = (type: string) => {
  let headers = "";
  let filename = `${type}_template.csv`;

  switch (type) {
    case 'cells':
      headers = "Brand,CellModelNo,NominalVoltage,Capacity,MaxContinuousDischargeRate,MaxContinuousChargeRate,Weight,Price,Cell_Height,Cell_Width,Cell_Thickness,Connection";
      break;
    case 'bms':
      headers = "brand,model,price,vdc_max,a_max,max_cells,link";
      break;
    case 'relays':
      headers = "brand,model,price,vdc_max,a_max,link";
      break;
    case 'fuses':
      headers = "brand,model,price,vdc_max,a_max,link";
      break;
    case 'cables':
      headers = "brand,model,price,section,vdc_max,a_max,link";
      break;
    case 'shunts':
      headers = "brand,model,price,vdc_max,a_max,link";
      break;
    default:
      headers = "col1,col2";
  }

  const blob = new Blob([headers], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};


const DIYTool = () => {
  // Config States
  const [useCase, setUseCase] = useState("custom");
  const [includeComponents, setIncludeComponents] = useState(true);
  const [dataSource, setDataSource] = useState<'default' | 'custom'>('default');

  // Electrical Specs
  const [minVoltage, setMinVoltage] = useState("");
  const [maxVoltage, setMaxVoltage] = useState("");
  const [minContinuousPower, setMinContinuousPower] = useState("");
  const [peakPower, setPeakPower] = useState("");
  const [minEnergy, setMinEnergy] = useState("");

  // Limits
  const [targetPrice, setTargetPrice] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxWidth, setMaxWidth] = useState("");
  const [maxLength, setMaxLength] = useState("");
  const [maxHeight, setMaxHeight] = useState("");

  // File Upload States
  const [customFiles, setCustomFiles] = useState<{ [key: string]: File | null }>({
    cells: null,
    relays: null,
    cables: null,
    shunts: null,
    bms: null,
    fuses: null
  });

  // Results States
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Configuration[]>([]);
  const [plotResults, setPlotResults] = useState<Configuration[]>([]);
  const [totalConfigurations, setTotalConfigurations] = useState(0);
  const [selectedSolution, setSelectedSolution] = useState<Configuration | null>(null);
  const [xAxis, setXAxis] = useState("battery_energy");
  const [yAxis, setYAxis] = useState("total_price");
  const [activeTab, setActiveTab] = useState("best-solutions");

  const { toast } = useToast();

  const handlePresetChange = (value: string) => {
    setUseCase(value);
    const preset = USE_CASES[value];

    if (preset && preset.values) {
      if (preset.values.minVoltage) setMinVoltage(preset.values.minVoltage);
      if (preset.values.maxVoltage) setMaxVoltage(preset.values.maxVoltage);
      if (preset.values.minPower) setMinContinuousPower(preset.values.minPower);
      if (preset.values.minEnergy) setMinEnergy(preset.values.minEnergy);
      if (preset.values.maxWeight) setMaxWeight(preset.values.maxWeight || "");
      setPeakPower("");

      toast({
        title: "Settings Updated",
        description: `Parameters set for ${preset.label}. Adjust if needed, then click Generate.`,
      });
    }
  };

  const handleFileChange = (type: string, file: File | null) => {
    setCustomFiles(prev => ({ ...prev, [type]: file }));
    if (file) {
      toast({
        title: "File Attached",
        description: `${file.name} loaded for ${type}.`,
      });
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setShowResults(false);
    setResults([]);

    try {
      const configData = {
        min_voltage: Number(minVoltage) || 70,
        max_voltage: Number(maxVoltage) || 80,
        min_continuous_power: Number(minContinuousPower) || 2000,
        peak_power: Number(peakPower) || (Number(minContinuousPower) * 2),
        min_energy: Number(minEnergy) || 3000,
        max_weight: Number(maxWeight) || 100,
        max_price: Number(maxPrice) || 100000,
        max_width: Number(maxWidth) || 2000,
        max_length: Number(maxLength) || 10000,
        max_height: Number(maxHeight) || 2000,
        target_price: Number(targetPrice) || 0,
        ambient_temp: 25,
        include_components: includeComponents || true,
        debug: true,
      };

      const url = getApiUrl("calculate");
      let body;
      let headers: HeadersInit = {};

      if (dataSource === 'custom') {
        const formData = new FormData();
        formData.append('config', JSON.stringify(configData));
        formData.append('use_custom_db', 'true');

        Object.entries(customFiles).forEach(([key, file]) => {
          if (file) formData.append(key, file);
        });

        body = formData;
      } else {
        body = JSON.stringify(configData);
        headers = { 'Content-Type': 'application/json' };
      }

      console.log(`📡 A enviar pedido para: ${url} (Mode: ${dataSource})`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error: ${errorText}`);
      }

      const data = await response.json();

      const newResults = data.results || [];
      setResults(newResults);
      setPlotResults(data.plotResults || []);
      setTotalConfigurations(data.total || 0);
      setShowResults(true);

      if (data.total === 0) {
        toast({
          title: "No solutions found",
          description: "Try relaxing constraints or checking your custom CSVs.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success!",
          description: `Showing ${data.plotResults.length} configurations out of ${data.total} safe configurations.`,
        });

        setTimeout(() => {
          document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }

    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Ensure the Python backend is running.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const interpolateColor = (score: number) => {
    const opacity = Math.max(0.05, score / 100);
    return `rgba(249, 115, 22, ${opacity})`;
  };

  const CustomScatterDot = (props: any) => {
    const { cx, cy, payload } = props;
    const score = payload?.safety?.safety_score ?? 0;
    const color = interpolateColor(score);

    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={color}
        strokeWidth={1}
        style={{ cursor: "pointer" }}
      />
    );
  };

  const scrollToCalculator = () => {
    document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden mt-16 bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-accent/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        </div>

        <div className="container relative z-10 px-4 py-20 mx-auto text-center animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full text-accent font-medium">
              <Sparkles size={18} />
              <span>Free Battery Designer</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
            Design your own battery<br />in seconds.
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            Enter your specs, we calculate cells, BMS, and safety limits for you.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={scrollToCalculator} size="lg" className="text-lg">
              Start Designing <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg" asChild>
              <Link to="/pricing">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Interactive Calculator Section */}
      <section id="calculator" className="py-24 bg-background">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Battery Design Calculator</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Configure your battery specifications and get instant recommendations
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">

            {/* --- INPUT PANEL (LEFT) --- */}
            <div className="lg:col-span-1 space-y-6">

              {/* 1. PRESETS DROPDOWN */}
              <Card className="border-accent/30 bg-accent/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" /> Quick Start
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Label className="mb-2 block">What are you building?</Label>
                  <Select onValueChange={handlePresetChange} value={useCase}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select project type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(USE_CASES).map(([key, data]) => (
                        <SelectItem key={key} value={key}>{data.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* 2. FORMULARIO PRINCIPAL */}
              <Card className="shadow-soft animate-slide-up w-full">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 mb-2">
                    <Calculator className="w-5 h-5 text-accent" /> Configuration Inputs
                  </CardTitle>

                  {/* DB SWITCH */}
                  <Tabs value={dataSource} onValueChange={(v) => setDataSource(v as 'default' | 'custom')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="default" className="text-xs">Watt Builder Database</TabsTrigger>
                      <TabsTrigger value="custom" className="text-xs">My Database</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>

                <CardContent className="space-y-6">

                  {/* CUSTOM DB UPLOAD FIELDS */}
                  {dataSource === 'custom' && (
                    <div className="space-y-4 p-4 border border-dashed rounded-lg bg-slate-50">
                      <Label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Upload Components Data</Label>

                      {[
                        { id: 'cells', label: 'Cells' },
                        { id: 'bms', label: 'BMS' },
                        { id: 'relays', label: 'Relays' },
                        { id: 'cables', label: 'Cables' },
                        { id: 'shunts', label: 'Shunt' },
                        { id: 'fuses', label: 'Fuses' }
                      ].map((item) => (
                        <div key={item.id} className="grid grid-cols-[1fr_auto] gap-2 items-end">
                          <div className="space-y-1">
                            <Label htmlFor={item.id} className="text-xs">{item.label}</Label>
                            <Input
                              id={item.id}
                              type="file"
                              accept=".csv"
                              className="h-8 text-xs file:text-xs"
                              onChange={(e) => handleFileChange(item.id, e.target.files?.[0] || null)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={`Download ${item.label} Template`}
                            onClick={() => downloadCsvTemplate(item.id)}
                          >
                            <FileDown className="h-4 w-4 text-slate-500" />
                          </Button>
                        </div>
                      ))}
                      <p className="text-[10px] text-slate-500 mt-2 italic">*Upload at least Cells' data to proceed.</p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minVoltage">
                        Min Voltage (V)
                        <InfoTooltip content="The minimum voltage where your system shuts down (Low Voltage Cutoff)." />
                      </Label>
                      <Input id="minVoltage" type="number" value={minVoltage} onChange={(e) => setMinVoltage(e.target.value)} placeholder="e.g., 36" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxVoltage">
                        Max Voltage (V)
                        <InfoTooltip content="The battery voltage at 100% capacity. MUST match charger voltage." />
                      </Label>
                      <Input id="maxVoltage" type="number" value={maxVoltage} onChange={(e) => setMaxVoltage(e.target.value)} placeholder="e.g., 54.6" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="minContinuousPower">
                        Continuous Power (W)
                        <InfoTooltip content="Average power consumption. Used for thermal safety calculations." />
                      </Label>
                      <Input id="minContinuousPower" type="number" value={minContinuousPower} onChange={(e) => setMinContinuousPower(e.target.value)} placeholder="e.g., 3000" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="peakPower">
                        Peak Power (W)
                        <InfoTooltip content="The power level the battery is required to sustain for a duration of 30 seconds." />
                      </Label>
                      <Input
                        id="peakPower"
                        type="number"
                        value={peakPower}
                        onChange={(e) => setPeakPower(e.target.value)}
                        placeholder="e.g. 5000"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="minEnergy">
                        Min Energy (Wh)
                        <InfoTooltip content="Defines autonomy (range/runtime). Voltage x Ah = Wh." />
                      </Label>
                      <Input id="minEnergy" type="number" value={minEnergy} onChange={(e) => setMinEnergy(e.target.value)} placeholder="e.g., 2000" />
                    </div>

                    {/* Opcionais */}
                    <div className="space-y-2">
                      <Label>Max Weight (kg)
                        <InfoTooltip content="Maximum weight limit of the final battery pack." />
                      </Label>
                      <Input type="number" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Price ($)
                        <InfoTooltip content="Maximum budget." />
                      </Label>
                      <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Optional" />
                    </div>
                  </div>

                  {/* Dimensões */}
                  <div className="grid grid-cols-3 gap-2 border-t pt-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Max L (mm)</Label>
                      <Input className="h-8 text-xs" type="number" value={maxLength} onChange={(e) => setMaxLength(e.target.value)} placeholder="Opt" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Max W (mm)</Label>
                      <Input className="h-8 text-xs" type="number" value={maxWidth} onChange={(e) => setMaxWidth(e.target.value)} placeholder="Opt" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Max H (mm)</Label>
                      <Input className="h-8 text-xs" type="number" value={maxHeight} onChange={(e) => setMaxHeight(e.target.value)} placeholder="Opt" />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 py-4">
                    <Checkbox
                      id="includeComponents"
                      checked={includeComponents}
                      onCheckedChange={(checked) => setIncludeComponents(checked as boolean)}
                      className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 border-gray-300"
                    />
                    <Label htmlFor="includeComponents" className="cursor-pointer">
                      Calculate BMS, Fuse & Accessories
                      <InfoTooltip content="Uncheck to calculate only raw cell configuration." />
                    </Label>
                  </div>
                  <Button onClick={handleGenerate} className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating...</> : <><Zap className="mr-2 h-5 w-5" /> Generate Design</>}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* --- OUTPUT PANEL (RIGHT) --- */}
            <div className="lg:col-span-2 relative z-0" id="results-section">
              <Card className="shadow-soft animate-slide-up w-full h-full" style={{ animationDelay: "100ms" }}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><Battery className="w-5 h-5 text-accent" /> Results</span>
                    {showResults && <Badge variant="secondary">{totalConfigurations} options found</Badge>}
                  </CardTitle>
                  <CardDescription>Your optimized battery designs</CardDescription>
                </CardHeader>
                <CardContent>
                  {!showResults ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground border-2 border-dashed rounded-xl">
                      <Calculator className="w-16 h-16 mb-4 opacity-20" />
                      <p>Fill the specs and click "Generate" to see results.</p>
                    </div>
                  ) : showResults && results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                      <Battery className="w-16 h-16 opacity-30 mb-4" />
                      <p>No valid configurations found with these limits.<br />Try increasing Max Price or Weight.</p>
                    </div>
                  ) : (
                    <Tabs defaultValue="best-solutions" value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="best-solutions">Recommended</TabsTrigger>
                        <TabsTrigger value="plot">Graph View</TabsTrigger>
                      </TabsList>

                      <TabsContent value="best-solutions">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {findBestConfigurations(results, Number(targetPrice) || 0).map(({ title, config, metric }, idx) => (
                            <Card
                              key={title + idx}
                              className={`cursor-pointer hover:shadow-lg transition-all border-l-4 ${config.safety.is_safe ? 'border-l-[#f97316]' : 'border-l-red-500'}`}
                              onClick={() => setSelectedSolution(config)}
                            >
                              <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <CardTitle className="text-lg">{title}</CardTitle>
                                    <CardDescription>{metric(config)}</CardDescription>
                                  </div>
                                  <Badge variant={config.safety.safety_score > 0 ? "default" : "destructive"}>
                                    Safety: {config.safety.safety_score}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="text-sm space-y-1">
                                <p><strong>Cell Model:</strong> {config.cell.CellModelNo}</p>
                                <p><strong>Configuration:</strong> {config.series_cells}S {config.parallel_cells}P</p>
                                <p><strong>Energy:</strong> {formatUnit(config.battery_energy, 'Wh')}</p>
                                <p><strong>Cells' Weight:</strong> {config.battery_weight.toFixed(1)} kg</p>
                                <p><strong>Estimated Price:</strong> ${config.total_price.toFixed(2)}</p>
                                {config.safety.warnings.length > 0 && (
                                  <div className="mt-2 text-xs text-amber-600 flex items-center gap-1 font-semibold">
                                    <AlertTriangle className="w-3 h-3" /> Check Warnings
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="plot" className="h-[500px] flex flex-col">
                        <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
                          <div>
                            <Label>X Axis</Label>
                            <Select value={xAxis} onValueChange={setXAxis}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="battery_energy">Energy (Wh)</SelectItem>
                                <SelectItem value="battery_weight">Weight (kg)</SelectItem>
                                <SelectItem value="battery_voltage">Voltage (V)</SelectItem>
                                <SelectItem value="battery_capacity">Capacity (Ah)</SelectItem>
                                <SelectItem value="total_price">Price ($)</SelectItem>
                                <SelectItem value="peak_power">Power (W)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Y Axis</Label>
                            <Select value={yAxis} onValueChange={setYAxis}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="battery_energy">Energy (Wh)</SelectItem>
                                <SelectItem value="battery_weight">Weight (kg)</SelectItem>
                                <SelectItem value="battery_voltage">Voltage (V)</SelectItem>
                                <SelectItem value="battery_capacity">Capacity (Ah)</SelectItem>
                                <SelectItem value="total_price">Price ($)</SelectItem>
                                <SelectItem value="peak_power">Power (W)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex flex-1 min-h-0 w-full">
                          <div className="flex-1 h-full w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart margin={{ top: 20, right: 10, bottom: 20, left: 0 }}>
                                <CartesianGrid />
                                <XAxis
                                  type="number"
                                  dataKey={xAxis}
                                  name={xAxis}
                                  label={{
                                    value: xAxis.replace('_', ' ').toUpperCase(),
                                    position: 'bottom',
                                    offset: 0
                                  }}
                                />
                                <YAxis
                                  type="number"
                                  dataKey={yAxis}
                                  name={yAxis}
                                  label={{
                                    value: yAxis.replace('_', ' ').toUpperCase(),
                                    angle: -90,
                                    position: 'insideLeft',
                                    style: { textAnchor: 'middle' }
                                  }}
                                />
                                <ChartTooltip
                                  cursor={{ strokeDasharray: '3 3' }}
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-background border border-border p-3 rounded-lg shadow-lg z-50">
                                          <p className="font-semibold">{data.cell.CellModelNo}</p>
                                          <p className="text-sm text-muted-foreground">{data.series_cells}S{data.parallel_cells}P</p>
                                          <div className="my-1 h-px bg-border" />
                                          <p className="text-sm">Energy: {formatUnit(data.battery_energy, "Wh")}</p>
                                          <p className="text-sm">Price: ${data.total_price.toFixed(2)}</p>
                                          <p className="text-sm">Weight: {data.battery_weight.toFixed(1)} kg</p>
                                          <p className="text-xs text-muted-foreground mt-1">Safety Score: {data.safety_score}%</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Scatter
                                  name="Batteries"
                                  data={plotResults}
                                  fill="#8884d8"
                                  shape={CustomScatterDot}
                                  onClick={(d) => setSelectedSolution(d.payload)}
                                />
                              </ScatterChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {selectedSolution && (
        <SolutionDetailModal
          solution={selectedSolution}
          isOpen={!!selectedSolution}
          onClose={() => setSelectedSolution(null)}
          showComponents={includeComponents}
        />
      )}
    </div>
  );
};

// --- UPDATED DETAIL MODAL ---
const SolutionDetailModal = ({ solution, isOpen, onClose, showComponents }: { solution: Configuration, isOpen: boolean, onClose: () => void, showComponents: boolean }) => {
  if (!solution) return null;

  const [showDiagram, setShowDiagram] = useState(false);

  // NEW STATES FOR COMMERCIAL
  const [laborCost, setLaborCost] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [margin, setMargin] = useState(20); // Default 20%
  const [includeCostsInBom, setIncludeCostsInBom] = useState(true);

  // Calculated Price
  const basePrice = solution.total_price;
  const costPrice = basePrice + laborCost + shippingCost;
  const finalPrice = costPrice * (1 + margin / 100);

  const AffiliateLink = ({ link }: { link?: string }) => {
    if (!link) return null;
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1 mt-1">
        Buy from Affiliate <ExternalLink className="inline w-3 h-3" />
      </a>
    );
  };

  // --- BOM CSV GENERATOR ---
  const downloadBOM = () => {
    const rows = [
      ['Component', 'Model', 'Quantity', 'Details']
    ];

    if (includeCostsInBom) {
      rows[0].push('Unit Price', 'Total Price');
    }

    const addRow = (name: string, model: string, qty: number, details: string, unitPrice: number) => {
      const row = [name, model, qty.toString(), details];
      if (includeCostsInBom) {
        row.push(unitPrice.toFixed(2), (unitPrice * qty).toFixed(2));
      }
      rows.push(row);
    };

    // Cells
    const totalCells = solution.series_cells * solution.parallel_cells;
    addRow(
      'Battery Cells',
      solution.cell.CellModelNo,
      totalCells,
      `${solution.cell.NominalVoltage}V ${solution.cell.Capacity}mAh`,
      solution.cell.Price
    );

    // Components
    if (solution.bms) addRow('BMS', solution.bms.model, 1, `Max ${solution.bms.a_max}A`, solution.bms.master_price || solution.bms.price);
    if (solution.fuse) addRow('Fuse', solution.fuse.model, 1, `${solution.fuse.a_max}A`, solution.fuse.price);
    if (solution.relay) addRow('Relay', solution.relay.model, 1, `${solution.relay.a_max}A`, solution.relay.price);
    if (solution.shunt) addRow('Shunt', solution.shunt.model, 1, `${solution.shunt.a_max}A`, solution.shunt.price);
    if (solution.cable) addRow('Cable (2m)', solution.cable.model, 1, `${solution.cable.section}mm²`, solution.cable.price);

    // Extras
    if (includeCostsInBom && laborCost > 0) rows.push(['Labor', '-', '1', '-', laborCost.toFixed(2), laborCost.toFixed(2)]);
    if (includeCostsInBom && shippingCost > 0) rows.push(['Shipping', '-', '1', '-', shippingCost.toFixed(2), shippingCost.toFixed(2)]);

    // CSV Content
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BOM_${solution.series_cells}S${solution.parallel_cells}P_${solution.cell.CellModelNo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- DATASHEET GENERATOR ---
  const downloadDatasheet = () => {
    const content = `
TECHNICAL DATASHEET
Generated by Watt Builder
--------------------------------------------------
Project Configuration: ${solution.series_cells}S${solution.parallel_cells}P
Cell Model: ${solution.cell.Brand} ${solution.cell.CellModelNo}

ELECTRICAL SPECIFICATIONS
-------------------------
Nominal Voltage:      ${solution.battery_voltage.toFixed(1)} V
Capacity:             ${solution.battery_capacity.toFixed(1)} Ah
Total Energy:         ${formatUnit(solution.battery_energy, 'Wh')}
Max Continuous Power: ${formatUnit(solution.continuous_power, 'W')}
Peak Power (30s):     ${formatUnit(solution.peak_power, 'W')}

MECHANICAL SPECIFICATIONS
-------------------------
Total Cell Weight:    ${solution.battery_weight.toFixed(2)} kg (Cells only)
Cell Dimensions:      ${solution.cell.Cell_Width}x${solution.cell.Cell_Height} mm

COMPONENTS LIST
---------------
BMS:    ${solution.bms ? `${solution.bms.brand} ${solution.bms.model}` : 'Not selected'}
Fuse:   ${solution.fuse ? `${solution.fuse.brand} ${solution.fuse.model}` : 'Not selected'}
Relay:  ${solution.relay ? `${solution.relay.brand} ${solution.relay.model}` : 'Not selected'}

SAFETY
------
Safety Score: ${solution.safety.safety_score}/100
Status: ${solution.safety.is_safe ? 'PASS' : 'WARNING'}
Warnings: ${solution.safety.warnings.length > 0 ? solution.safety.warnings.join('; ') : 'None'}

--------------------------------------------------
Disclaimer: This datasheet is generated automatically and is for reference only. 
Always verify specifications with component manufacturers.
    `;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Datasheet_${solution.series_cells}S${solution.parallel_cells}P.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            Configuration: {solution.cell.CellModelNo} ({solution.series_cells}S{solution.parallel_cells}P)
            <Badge className={solution.safety.is_safe ? "bg-emerald-600" : "bg-red-600"}>
              Safety Score: {solution.safety.safety_score}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Disclaimer */}
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 my-4 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <InfoTooltip content="Important Disclaimer" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-orange-700 font-medium">
                <strong>Disclaimer: This calculation is a theoretical suggestion.</strong>
              </p>
              <p className="text-sm text-orange-700 mt-1">
                Building lithium batteries carries significant risks. The results below are automated estimates.
                <strong> Always consult a professional.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Safety Warnings */}
        {solution.safety.warnings.length > 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-4">
            <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5" /> Safety Advisories
            </h4>
            <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
              {solution.safety.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
            {solution.safety.recommendations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-200">
                <span className="text-xs font-bold uppercase text-amber-700">Recommendations:</span>
                <ul className="list-disc pl-5 text-sm text-amber-800 mt-1">
                  {solution.safety.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">

          {/* Column 1: Specs */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Battery Specs</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Configuration:</strong> {solution.series_cells}S {solution.parallel_cells}P</p>
                <p><strong>Nominal Voltage:</strong> {solution.battery_voltage.toFixed(1)} V</p>
                <p><strong>Capacity:</strong> {solution.battery_capacity.toFixed(1)} Ah</p>
                <p><strong>Energy:</strong> {formatUnit(solution.battery_energy, 'Wh')}</p>
                <p><strong>Continuous Power:</strong> {formatUnit(solution.continuous_power, 'W')}</p>
                <p><strong>Peak Power:</strong> {formatUnit(solution.peak_power, 'W')}</p>
                <p><strong>Cells' Weight:</strong> {solution.battery_weight.toFixed(2)} kg</p>
                <p className="font-bold mt-2 border-t pt-1">Components Price: ${solution.total_price.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Cell Data</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Brand:</strong> {solution.cell.Brand}</p>
                <p><strong>Model:</strong> {solution.cell.CellModelNo}</p>
                <p><strong>Nominal Voltage:</strong> {solution.cell.NominalVoltage}</p>
                <p><strong>Cont. Discharge:</strong> {solution.cell.MaxContinuousDischargeRate}C</p>
                <p><strong>Capacity:</strong> {solution.cell.Capacity / 1000} Ah</p>
                <p><strong>Price/Cell:</strong> ${solution.cell.Price.toFixed(2)}</p>
                <AffiliateLink link={solution.cell.Connection} />
              </CardContent>
            </Card>
          </div>

          {/* Column 2: Commercial & Export (NEW FEATURE) */}
          <div className="space-y-4">
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" /> Commercial Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Labor Cost ($)</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={laborCost}
                      onChange={(e) => setLaborCost(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Shipping Cost ($)</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Profit Margin (%)</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                  />
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-slate-600">Base Cost:</span>
                    <span className="text-sm">${costPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-green-700">Final Price:</span>
                    <span className="text-lg font-bold text-green-700">${finalPrice.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="w-4 h-4" /> Downloads
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="bomCosts"
                    checked={includeCostsInBom}
                    onCheckedChange={(c) => setIncludeCostsInBom(c as boolean)}
                  />
                  <Label htmlFor="bomCosts" className="text-xs cursor-pointer">Include costs in BOM</Label>
                </div>
                <Button variant="outline" className="w-full justify-start h-9" onClick={downloadBOM}>
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                  Download BOM (Excel/CSV)
                </Button>
                <Button variant="outline" className="w-full justify-start h-9" onClick={downloadDatasheet}>
                  <FileText className="w-4 h-4 mr-2 text-blue-600" />
                  Download Technical Datasheet
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Column 3: Components List */}
          {showComponents && (
            <div className="space-y-4">
              {solution.bms && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" /> BMS</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>Brand:</strong> {solution.bms.brand}</p>
                    <p><strong>Model:</strong> {solution.bms.model}</p>
                    <p><strong>Spec:</strong> {solution.bms.a_max}A / {solution.bms.max_cells} Cells</p>
                    <p><strong>Price:</strong> ${solution.bms.master_price?.toFixed(2) || solution.bms.price.toFixed(2)}</p>
                    <AffiliateLink link={solution.bms.link} />
                  </CardContent>
                </Card>
              )}
              {solution.fuse && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Fuse</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>Model:</strong> {solution.fuse.brand} {solution.fuse.model}</p>
                    <p><strong>Rating:</strong> {solution.fuse.a_max}A / {solution.fuse.vdc_max}V</p>
                    <p><strong>Price:</strong> ${solution.fuse.price.toFixed(2)}</p>
                  </CardContent>
                </Card>
              )}
              {solution.relay && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Relay</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>Model:</strong> {solution.relay.brand} {solution.relay.model}</p>
                    <p><strong>Rating:</strong> {solution.relay.a_max}A</p>
                    <p><strong>Price:</strong> ${solution.relay.price.toFixed(2)}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* --- Wiring Diagram --- */}
        {showComponents && (
          <div className="mb-6 mt-4">
            <Button
              variant="outline"
              className="w-full flex items-center justify-between border-slate-300 text-slate-700 hover:bg-slate-50"
              onClick={() => setShowDiagram(!showDiagram)}
            >
              <span className="flex items-center gap-2">
                <CircuitBoard className="w-4 h-4 text-amber-600" />
                {showDiagram ? "Hide Wiring Diagram" : "Show Wiring Diagram"}
              </span>
              {showDiagram ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </Button>

            {showDiagram && (
              <div className="mt-4 animate-in fade-in zoom-in-95 duration-300">
                <WiringDiagram config={solution} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DIYTool;