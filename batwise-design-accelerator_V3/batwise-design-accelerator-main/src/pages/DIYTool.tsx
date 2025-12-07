import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Battery, Zap, Calculator, Sparkles, Loader2, BarChart3, ExternalLink, AlertTriangle, CheckCircle, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// --- IMPORTS CUSTOMIZADOS ---
import { InfoTooltip } from "@/components/ui/InfoTooltip"; // Certifica-te que este ficheiro existe
import { USE_CASES } from "@/lib/presets"; // O ficheiro que mostraste acima
// ----------------------------

// --- TIPAGEM LOCAL (Para garantir compatibilidade com o teu Backend Python) ---
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
  safety: SafetyAssessment; // O campo novo vindo do Python
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

// Função auxiliar para encontrar melhores configs (mantida, mas ajustada para os novos tipos se necessário)
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
    // Penalizar configurações inseguras no score ótimo
    if (!config.safety.is_safe) return 0;

    const energyDensity = config.battery_energy / config.battery_weight;
    const maxEnergyDensity = Math.max(...configs.map(c => c.battery_energy / c.battery_weight));
    const normalizedDensity = energyDensity / maxEnergyDensity;

    const priceDifference = Math.abs(config.total_price - targetPrice);
    const maxPriceDiff = Math.max(...configs.map(c => Math.abs(c.total_price - targetPrice)));
    const normalizedPrice = 1 - (priceDifference / maxPriceDiff);

    return (normalizedDensity + normalizedPrice) / 2;
  };

  return [
    { title: "Lowest Price", config: findBest(c => c.total_price, 'min'), metric: (c: Configuration) => `€${c.total_price.toFixed(2)}` },
    { title: "Highest Energy", config: findBest(c => c.battery_energy), metric: (c: Configuration) => formatUnit(c.battery_energy, 'Wh') },
    { title: "Highest Energy Density", config: findBest(c => c.battery_energy / c.battery_weight), metric: (c: Configuration) => `${(c.battery_energy / c.battery_weight).toFixed(1)} Wh/kg` },
    { title: "Best Value", config: findBest(c => c.battery_energy / c.total_price), metric: (c: Configuration) => `${(c.battery_energy / c.total_price).toFixed(1)} Wh/€` },
    { title: "Lightest", config: findBest(c => c.battery_weight, 'min'), metric: (c: Configuration) => `${c.battery_weight.toFixed(1)} kg` },
    { title: "Optimal Balance", config: findBest(c => calculateOptimalScore(c)), metric: (c: Configuration) => `${(c.battery_energy / c.battery_weight).toFixed(1)} Wh/kg @ €${c.total_price.toFixed(0)}` }
  ];
};

const DIYTool = () => {
  const [useCase, setUseCase] = useState("custom");
  const [minVoltage, setMinVoltage] = useState("");
  const [maxVoltage, setMaxVoltage] = useState("");
  const [minContinuousPower, setMinContinuousPower] = useState("");
  const [minEnergy, setMinEnergy] = useState("");
  const [maxEnergy, setMaxEnergy] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxWidth, setMaxWidth] = useState("");
  const [maxLength, setMaxLength] = useState("");
  const [maxHeight, setMaxHeight] = useState("");
  const [inverter, setInverter] = useState("");
  const [outputVoltage, setOutputVoltage] = useState("");

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

  // --- LÓGICA DE PRESETS ---
  const handlePresetChange = (value: string) => {
    setUseCase(value);
    const preset = USE_CASES[value];

    if (preset && preset.values) {
      // Apenas preenchemos os campos. NÃO chamamos o backend.
      if (preset.values.minVoltage) setMinVoltage(preset.values.minVoltage);
      if (preset.values.maxVoltage) setMaxVoltage(preset.values.maxVoltage);
      if (preset.values.minPower) setMinContinuousPower(preset.values.minPower);
      if (preset.values.minEnergy) setMinEnergy(preset.values.minEnergy);
      if (preset.values.maxWeight) setMaxWeight(preset.values.maxWeight || "");

      toast({
        title: "Settings Updated",
        description: `Parameters set for ${preset.label}. Adjust if needed, then click Generate.`,
      });
    }
  };

  // --- LÓGICA DE GERAÇÃO (BACKEND) ---
  const handleGenerate = async () => {
    setIsLoading(true);
    setShowResults(false);
    setResults([]);

    // URL do teu backend Python
    const API_URL = "http://127.0.0.1:8000";

    try {
      // Conversão e defaults para mm (inputs assumem-se em mm ou valores brutos)
      const payload = {
        min_voltage: Number(minVoltage) || 0,
        max_voltage: Number(maxVoltage) || 0,
        min_continuous_power: Number(minContinuousPower) || 0,
        min_energy: Number(minEnergy) || 0,
        max_weight: Number(maxWeight) || 1000, // Default alto se vazio
        max_price: Number(maxPrice) || 10000,
        max_width: Number(maxWidth) || 2000,
        max_length: Number(maxLength) || 2000,
        max_height: Number(maxHeight) || 2000,
        ambient_temp: 25,
        debug: true,
      };

      console.log("Sending to Python:", payload);

      const response = await fetch(`${API_URL}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
          description: "Try relaxing constraints (especially Price, Dimensions or Weight).",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success!",
          description: `Found ${data.total} safe configurations.`,
        });

        // Scroll suave para os resultados
        setTimeout(() => {
          document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }

    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "Connection Failed",
        description: "Ensure the Python backend is running (uvicorn main:app).",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
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
              <span>Free DIY Battery Designer</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
            Design your own battery<br />in minutes.
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            Enter your specs — we calculate cells, BMS, and safety limits for you.
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
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-accent" /> Configuration Inputs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minVoltage">
                        Min Voltage (V)
                        <InfoTooltip content="Voltage when battery is 0% empty. Usually 3.0V per cell." />
                      </Label>
                      <Input id="minVoltage" type="number" value={minVoltage} onChange={(e) => setMinVoltage(e.target.value)} placeholder="e.g., 36" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxVoltage">
                        Max Voltage (V)
                        <InfoTooltip content="Voltage when 100% full. Must match your charger voltage." />
                      </Label>
                      <Input id="maxVoltage" type="number" value={maxVoltage} onChange={(e) => setMaxVoltage(e.target.value)} placeholder="e.g., 54.6" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="minContinuousPower">
                        Continuous Power (W)
                        <InfoTooltip content="Average power your device consumes constantly." />
                      </Label>
                      <Input id="minContinuousPower" type="number" value={minContinuousPower} onChange={(e) => setMinContinuousPower(e.target.value)} placeholder="e.g., 3000" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="minEnergy">
                        Min Energy (Wh)
                        <InfoTooltip content="Determines your range or runtime." />
                      </Label>
                      <Input id="minEnergy" type="number" value={minEnergy} onChange={(e) => setMinEnergy(e.target.value)} placeholder="e.g., 2000" />
                    </div>

                    {/* Opcionais */}
                    <div className="space-y-2">
                      <Label>Target Price (€)</Label>
                      <Input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="e.g., 500" />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Weight (kg)</Label>
                      <Input type="number" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Price (€)</Label>
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

                  <Button onClick={handleGenerate} className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating...</> : <><Zap className="mr-2 h-5 w-5" /> Generate Design</>}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* --- OUTPUT PANEL (RIGHT) --- */}
            <div className="lg:col-span-2" id="results-section">
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

                      <TabsContent value="best-solutions" className="space-y-4">
                        {findBestConfigurations(results, Number(targetPrice) || 0).map(({ title, config, metric }, idx) => (
                          <Card
                            key={title + idx}
                            className={`cursor-pointer hover:shadow-lg transition-all border-l-4 ${config.safety.is_safe ? 'border-l-emerald-500' : 'border-l-red-500'}`}
                            onClick={() => setSelectedSolution(config)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-lg">{title}</CardTitle>
                                  <CardDescription>{metric(config)}</CardDescription>
                                </div>
                                <Badge variant={config.safety.safety_score > 80 ? "default" : "destructive"}>
                                  Safety: {config.safety.safety_score}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="text-sm space-y-1">
                              <p><strong>Model:</strong> {config.cell.CellModelNo}</p>
                              <p><strong>Config:</strong> {config.series_cells}S {config.parallel_cells}P</p>
                              <p><strong>Energy:</strong> {formatUnit(config.battery_energy, 'Wh')}</p>

                              {/* Aviso Rápido no Card */}
                              {config.safety.warnings.length > 0 && (
                                <div className="mt-2 text-xs text-amber-600 flex items-center gap-1 font-semibold">
                                  <AlertTriangle className="w-3 h-3" /> Check Warnings
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </TabsContent>

                      <TabsContent value="plot" className="h-[500px]">
                        {/* Manter a lógica do gráfico existente */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label>X Axis</Label>
                            <Select value={xAxis} onValueChange={setXAxis}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="battery_energy">Energy</SelectItem>
                                <SelectItem value="total_price">Price</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Y Axis</Label>
                            <Select value={yAxis} onValueChange={setYAxis}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="total_price">Price</SelectItem>
                                <SelectItem value="battery_weight">Weight</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid />
                            <XAxis type="number" dataKey={xAxis} name={xAxis} />
                            <YAxis type="number" dataKey={yAxis} name={yAxis} />
                            <ChartTooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name="Batteries" data={plotResults} fill="#10b981" onClick={(d) => setSelectedSolution(d.payload)} />
                          </ScatterChart>
                        </ResponsiveContainer>
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

      {/* DETAILS MODAL - UPDATED WITH SAFETY INFO */}
      {selectedSolution && (
        <SolutionDetailModal
          solution={selectedSolution}
          isOpen={!!selectedSolution}
          onClose={() => setSelectedSolution(null)}
        />
      )}
    </div>
  );
};

const SolutionDetailModal = ({ solution, isOpen, onClose }: { solution: Configuration, isOpen: boolean, onClose: () => void }) => {
  if (!solution) return null;

  const nominalCurrent = (solution.cell.Capacity / 1000) * solution.cell.MaxContinuousDischargeRate * solution.parallel_cells;
  const nominalPower = solution.battery_voltage * nominalCurrent;

  const AffiliateLink = ({ link }: { link?: string }) => {
    if (!link) return null;
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1 mt-1">
        Buy from Affiliate <ExternalLink className="inline w-3 h-3" />
      </a>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            Configuration: {solution.cell.CellModelNo} ({solution.series_cells}S{solution.parallel_cells}P)
            <Badge className={solution.safety.is_safe ? "bg-emerald-600" : "bg-red-600"}>
              Safety Score: {solution.safety.safety_score}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* --- SAFETY WARNINGS SECTION --- */}
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
          {/* Column 1: Battery Specs */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Battery Specs</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Voltage:</strong> {solution.battery_voltage.toFixed(1)} V</p>
                <p><strong>Capacity:</strong> {solution.battery_capacity.toFixed(1)} Ah</p>
                <p><strong>Energy:</strong> {formatUnit(solution.battery_energy, 'Wh')}</p>
                <p><strong>Continuous Power:</strong> {formatUnit(solution.continuous_power, 'W')}</p>
                <p><strong>Peak Power:</strong> {formatUnit(solution.peak_power, 'W')}</p>
                <p><strong>Total Weight:</strong> {solution.battery_weight.toFixed(2)} kg</p>
                <p className="font-bold mt-2 border-t pt-1">Total Price: €{solution.total_price.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Cell Data</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Brand:</strong> {solution.cell.Brand}</p>
                <p><strong>Model:</strong> {solution.cell.CellModelNo}</p>
                <p><strong>Discharge:</strong> {solution.cell.MaxContinuousDischargeRate}C</p>
                <p><strong>Price/Cell:</strong> €{solution.cell.Price.toFixed(2)}</p>
                <AffiliateLink link={solution.cell.Connection} />
              </CardContent>
            </Card>
          </div>

          {/* Column 2 & 3: Components */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {solution.bms && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" /> BMS</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>Model:</strong> {solution.bms.brand} {solution.bms.model}</p>
                  <p><strong>Max Current:</strong> {solution.bms.a_max} A</p>
                  <p><strong>Price:</strong> €{solution.bms.master_price?.toFixed(2)}</p>
                  <AffiliateLink link={solution.bms.link} />
                </CardContent>
              </Card>
            )}
            {solution.fuse && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Fuse</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>Model:</strong> {solution.fuse.brand} {solution.fuse.model}</p>
                  <p><strong>Rating:</strong> {solution.fuse.a_max} A / {solution.fuse.vdc_max} V</p>
                  <p><strong>Price:</strong> €{solution.fuse.price.toFixed(2)}</p>
                  <AffiliateLink link={solution.fuse.link} />
                </CardContent>
              </Card>
            )}
            {solution.relay && (
              <Card>
                <CardHeader><CardTitle className="text-base">Relay / Contactor</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>Model:</strong> {solution.relay.brand} {solution.relay.model}</p>
                  <p><strong>Rating:</strong> {solution.relay.a_max} A</p>
                  <p><strong>Price:</strong> €{solution.relay.price.toFixed(2)}</p>
                  <AffiliateLink link={solution.relay.link} />
                </CardContent>
              </Card>
            )}
            {solution.cable && (
              <Card>
                <CardHeader><CardTitle className="text-base">Cabling</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>Type:</strong> {solution.cable.model}</p>
                  <p><strong>Section:</strong> {solution.cable.section} mm²</p>
                  <p><strong>Est. Price (2m):</strong> €{solution.cable.price.toFixed(2)}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DIYTool;