import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Battery, Zap, Calculator, Sparkles, Loader2, Table2, BarChart3, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Configuration, Component } from "@/types"; // Importar os tipos
import { calculateBatteryDesign } from "@/lib/battery-calculator";

// Helper function to format W/Wh to kW/kWh
const formatUnit = (value: number, unit: 'W' | 'Wh') => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} k${unit}`;
  }
  return `${value.toFixed(0)} ${unit}`;
};

// Adicionar função para encontrar as melhores configurações
const findBestConfigurations = (configs: Configuration[], targetPrice: number) => {
  if (!configs.length) return [];

  const findBest = (metric: (c: Configuration) => number, compare: 'min' | 'max' = 'max') => {
    return configs.reduce((best, current) => {
      const bestMetric = metric(best);
      const currentMetric = metric(current);
      return (compare === 'max' ? currentMetric > bestMetric : currentMetric < bestMetric) ? current : best;
    });
  };

  // Nova função para calcular a pontuação baseada no preço target e densidade energética
  const calculateOptimalScore = (config: Configuration) => {
    const energyDensity = config.battery_energy / config.battery_weight;
    const maxEnergyDensity = Math.max(...configs.map(c => c.battery_energy / c.battery_weight));

    // Normalizar densidade energética (0-1)
    const normalizedDensity = energyDensity / maxEnergyDensity;

    // Calcular desvio do preço target (0-1, onde 1 é melhor)
    const priceDifference = Math.abs(config.total_price - targetPrice);
    const maxPriceDiff = Math.max(...configs.map(c => Math.abs(c.total_price - targetPrice)));
    const normalizedPrice = 1 - (priceDifference / maxPriceDiff);

    // Peso igual para ambos os fatores
    return (normalizedDensity + normalizedPrice) / 2;
  };

  const bestConfigs = [
    {
      title: "Lowest Price",
      config: findBest(c => c.total_price, 'min'),
      metric: (c: Configuration) => `€${c.total_price.toFixed(2)}`
    },
    {
      title: "Highest Energy",
      config: findBest(c => c.battery_energy),
      metric: (c: Configuration) => formatUnit(c.battery_energy, 'Wh')
    },
    {
      title: "Highest Energy Density",
      config: findBest(c => c.battery_energy / c.battery_weight),
      metric: (c: Configuration) => `${(c.battery_energy / c.battery_weight).toFixed(1)} Wh/kg`
    },
    {
      title: "Best Value",
      config: findBest(c => c.battery_energy / c.total_price),
      metric: (c: Configuration) => `${(c.battery_energy / c.total_price).toFixed(1)} Wh/€`
    },
    {
      title: "Lightest",
      config: findBest(c => c.battery_weight, 'min'),
      metric: (c: Configuration) => `${c.battery_weight.toFixed(1)} kg`
    },
    {
      title: "Optimal Balance",
      config: findBest(c => calculateOptimalScore(c)),
      metric: (c: Configuration) => `${(c.battery_energy / c.battery_weight).toFixed(1)} Wh/kg @ €${c.total_price.toFixed(0)}`
    }
  ];

  return bestConfigs;
};

const DIYTool = () => {
  const USE_LOCAL_FUNCTIONS = import.meta.env.VITE_USE_LOCAL_FUNCTIONS === 'true';
  const LOCAL_BATTERY_FUNCTION_URL = import.meta.env.VITE_BATTERY_DESIGN_URL || 'http://localhost:8000';
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


const handleGenerate = async () => {
  setIsLoading(true);
  setShowResults(false);

  // Pequeno delay para permitir que o UI mostre o "Loading" antes de congelar brevemente no cálculo
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    const payload = {
      min_voltage: minVoltage || '80',
      max_voltage: maxVoltage || '90',
      min_continuous_power: minContinuousPower || '3000',
      min_energy: minEnergy || '3000',
      max_weight: maxWeight || '65',
      max_price: maxPrice || '5000',
      max_width: maxWidth || '900',
      max_length: maxLength || '340',
      max_height: maxHeight || '250',
      debug: true,
    };

    // Cálculo direto no browser (síncrono)
    const data = calculateBatteryDesign(payload);

    setResults(data.results || []);
    setPlotResults(data.plotResults || []);
    setTotalConfigurations(data.total || 0);
    setShowResults(true);

    if (data.results.length === 0) {
      toast({
        title: "No configurations found",
        description: "Try adjusting your requirements to find matching battery configurations.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Design generated successfully!",
        description: `Found ${data.total} valid configurations.`,
      });
    }
  } catch (error) {
    console.error('Error generating design:', error);
    toast({
      title: "Error generating design",
      description: "Please check your inputs and try again.",
      variant: "destructive"
    });
  } finally {
    setIsLoading(false);
  }
};


/*  const handleGenerate = async () => {
    setIsLoading(true);
    setShowResults(false);

    // URL do teu backend Python local
    const API_URL = "http://127.0.0.1:8000";

    try {
      // Prepara os dados (Payload)
      const payload = {
        min_voltage: Number(minVoltage) || 80,
        max_voltage: Number(maxVoltage) || 90,
        min_continuous_power: Number(minContinuousPower) || 3000,
        min_energy: Number(minEnergy) || 3000,
        max_weight: Number(maxWeight) || 65,
        max_price: Number(maxPrice) || 5000,
        max_width: Number(maxWidth) || 900,
        max_length: Number(maxLength) || 340,
        max_height: Number(maxHeight) || 250,
        ambient_temp: 35, // O Python precisa disto
        debug: true,
      };

      console.log("Enviando pedido para Python:", payload); // Log para debug

      // Faz o pedido FETCH normal (em vez de supabase.functions.invoke)
      const response = await fetch(`${API_URL}/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro do servidor Python: ${errorText}`);
      }

      const data = await response.json();
      console.log("Resposta do Python:", data); // Log para veres os dados

      // Atualiza a UI com os dados recebidos
      setResults(data.results || []);
      setPlotResults(data.plotResults || []);
      setTotalConfigurations(data.total || 0);
      setShowResults(true);

      if (data.total === 0) {
        toast({
          title: "No configurations found",
          description: "Try adjusting your requirements.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Design generated!",
          description: `Found ${data.total} configurations via Python Backend.`,
        });
      }

    } catch (error: any) {
      console.error('Error generating design:', error);
      toast({
        title: "Error generating design",
        // Mostra o erro real para saberes o que se passa
        description: error.message || "Failed to communicate with backend",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };*/

  const scrollToCalculator = () => {
    document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden mt-16 bg-gradient-to-br from-background via-muted/30 to-background">
        {/* Animated Background Elements */}
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
            Enter your specs — we calculate cells, BMS, and relays for you.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={scrollToCalculator}
              size="lg"
              className="text-lg"
            >
              Start Designing
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-lg"
              asChild
            >
              <Link to="/pricing">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Interactive Calculator Section */}
      <section id="calculator" className="py-24 bg-background">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="text-center mb-12 animate-slide-up">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Battery Design Calculator
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Configure your battery specifications and get instant recommendations
            </p>
          </div>

          <div className="flex flex-col items-center gap-8">
            {/* Input Panel */}
            <Card className="shadow-soft animate-slide-up w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-accent" />
                  Configuration Inputs
                </CardTitle>
                <CardDescription>
                  Enter your battery requirements below
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minVoltage">Minimum Nominal Voltage (V)</Label>
                    <Input
                      id="minVoltage"
                      type="number"
                      placeholder="e.g., 36"
                      value={minVoltage}
                      onChange={(e) => setMinVoltage(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxVoltage">Maximum Nominal Voltage (V)</Label>
                    <Input
                      id="maxVoltage"
                      type="number"
                      placeholder="e.g., 54.6"
                      value={maxVoltage}
                      onChange={(e) => setMaxVoltage(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minContinuousPower">Minimum Continuous Power (W)</Label>
                    <Input
                      id="minContinuousPower"
                      type="number"
                      placeholder="e.g., 3000"
                      value={minContinuousPower}
                      onChange={(e) => setMinContinuousPower(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minEnergy">Minimum Energy (Wh)</Label>
                    <Input
                      id="minEnergy"
                      type="number"
                      placeholder="e.g., 2000"
                      value={minEnergy}
                      onChange={(e) => setMinEnergy(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxEnergy">Maximum Energy (Wh)</Label>
                    <Input
                      id="maxEnergy"
                      type="number"
                      placeholder="e.g., 5000"
                      value={maxEnergy}
                      onChange={(e) => setMaxEnergy(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="targetPrice">Target Price (€)</Label>
                    <Input
                      id="targetPrice"
                      type="number"
                      placeholder="e.g., 500"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxWeight">Maximum Weight (kg)</Label>
                    <Input
                      id="maxWeight"
                      type="number"
                      placeholder="e.g., 30"
                      value={maxWeight}
                      onChange={(e) => setMaxWeight(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxPrice">Maximum Price (€)</Label>
                    <Input
                      id="maxPrice"
                      type="number"
                      placeholder="e.g., 1000"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxWidth">Maximum Width (mm)</Label>
                    <Input
                      id="maxWidth"
                      type="number"
                      placeholder="e.g., 300"
                      value={maxWidth}
                      onChange={(e) => setMaxWidth(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxLength">Maximum Length (mm)</Label>
                    <Input
                      id="maxLength"
                      type="number"
                      placeholder="e.g., 400"
                      value={maxLength}
                      onChange={(e) => setMaxLength(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxHeight">Maximum Height (mm)</Label>
                    <Input
                      id="maxHeight"
                      type="number"
                      placeholder="e.g., 200"
                      value={maxHeight}
                      onChange={(e) => setMaxHeight(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inverter">Inverter</Label>
                    <Select value={inverter} onValueChange={setInverter}>
                      <SelectTrigger id="inverter">
                        <SelectValue placeholder="Select inverter type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Car Inverter</SelectItem>
                        <SelectItem value="home">Home Inverter</SelectItem>
                        <SelectItem value="none">No Inverter</SelectItem>
                        <SelectItem value="other">Inverter for other application</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {inverter === "other" && (
                    <div className="space-y-2">
                      <Label htmlFor="outputVoltage">Output Voltage (V)</Label>
                      <Input
                        id="outputVoltage"
                        type="number"
                        placeholder="e.g., 230"
                        value={outputVoltage}
                        onChange={(e) => setOutputVoltage(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleGenerate}
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Generate Design
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Output Panel */}
            <Card className="shadow-soft animate-slide-up w-full" style={{ animationDelay: "100ms" }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Battery className="w-5 h-5 text-accent" />
                  Suggested Configuration
                </CardTitle>
                <CardDescription>
                  Your optimized battery design
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showResults && results.length > 0 ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                      <h3 className="font-semibold text-foreground mb-2">Best Matching Configurations</h3>
                      <p className="text-sm text-muted-foreground">
                        Found {totalConfigurations} valid configurations.
                      </p>
                    </div>

                    <Tabs
                      defaultValue="best-solutions"
                      className="w-full"
                      value={activeTab}
                      onValueChange={setActiveTab}
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="best-solutions" className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          Best Solutions View
                        </TabsTrigger>
                        <TabsTrigger value="plot" className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          Plot View
                        </TabsTrigger>
                      </TabsList>

                      {/* Best Solutions View */}
                      <TabsContent value="best-solutions" className="space-y-4">
                        <div className="p-3 bg-accent/10 rounded-lg border border-accent/20 mb-4">
                          <p className="text-sm text-muted-foreground">
                            * O peso apresentado não considera eletrónica nem caixa
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {findBestConfigurations(results, Number(targetPrice) || 0).map(({ title, config, metric }) => (
                            <Card
                              key={title}
                              className="cursor-pointer hover:shadow-lg transition-shadow"
                              onClick={() => setSelectedSolution(config)}
                            >
                              <CardHeader>
                                <CardTitle className="text-lg">{title}</CardTitle>
                                <CardDescription>{metric(config)}</CardDescription>
                              </CardHeader>
                              <CardContent className="text-sm space-y-1">
                                <p><strong>Model:</strong> {config.cell.CellModelNo}</p>
                                <p><strong>Config:</strong> {config.series_cells}S{config.parallel_cells}P</p>
                                <p><strong>Energy:</strong> {formatUnit(config.battery_energy, 'Wh')}</p>
                                <p><strong>Weight:</strong> {config.battery_weight.toFixed(1)} kg</p>
                                <p className="font-bold mt-2">Price: €{config.total_price.toFixed(2)}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        <div className="pt-4 border-t border-border">
                          <p className="text-sm text-muted-foreground mb-3">
                            🔒 Unlock full cell catalogue, detailed specifications, and PDF export
                          </p>
                          <Button variant="outline" className="w-full" asChild>
                            <Link to="/pricing">Upgrade to Professional Version</Link>
                          </Button>
                        </div>
                      </TabsContent>

                      {/* Plot View */}
                      <TabsContent
                        value="plot"
                        className={`space-y-4 transition-all duration-200 ${activeTab === "plot" ? "min-h-[600px]" : "min-h-0"
                          }`}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>X-Axis Parameter</Label>
                            <Select value={xAxis} onValueChange={setXAxis}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="battery_energy">Energy (Wh)</SelectItem>
                                <SelectItem value="battery_weight">Weight (kg)</SelectItem>
                                <SelectItem value="battery_voltage">Voltage (V)</SelectItem>
                                <SelectItem value="battery_capacity">Capacity (Ah)</SelectItem>
                                <SelectItem value="total_price">Total Price (€)</SelectItem>
                                <SelectItem value="cell.Price">Cells Price (€)</SelectItem>
                                <SelectItem value="peak_power">Peak Power (W)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Y-Axis Parameter</Label>
                            <Select value={yAxis} onValueChange={setYAxis}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="total_price">Total Price (€)</SelectItem>
                                <SelectItem value="battery_energy">Energy (Wh)</SelectItem>
                                <SelectItem value="battery_weight">Weight (kg)</SelectItem>
                                <SelectItem value="battery_voltage">Voltage (V)</SelectItem>
                                <SelectItem value="battery_capacity">Capacity (Ah)</SelectItem>
                                <SelectItem value="cell.Price">Cells Price (€)</SelectItem>
                                <SelectItem value="peak_power">Peak Power (W)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="relative w-full h-[500px] overflow-hidden">
                          <ChartContainer config={{
                            battery: {
                              label: "Battery Configuration",
                              color: "hsl(var(--accent))",
                            },
                          }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart margin={{ top: 20, right: 30, bottom: 200, left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  type="number"
                                  dataKey={xAxis}
                                  name={xAxis}
                                  label={{
                                    value: xAxis.replace('_', ' ').toUpperCase(),
                                    position: 'bottom',
                                    offset: 20
                                  }}
                                />
                                <YAxis
                                  type="number"
                                  dataKey={yAxis}
                                  name={yAxis}
                                  label={{ value: yAxis.replace('_', ' ').toUpperCase(), angle: -90, position: 'insideLeft' }}
                                />
                                <ChartTooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
                                          <p className="font-semibold">{data.cell.CellModelNo}</p>
                                          <p className="text-sm text-muted-foreground">{data.series_cells}S{data.parallel_cells}P</p>
                                          <p className="text-sm">Energy: {formatUnit(data.battery_energy, "Wh")}</p>
                                          <p className="text-sm">Price: €{data.total_price.toFixed(2)}</p>
                                          <p className="text-sm">Weight: {data.battery_weight.toFixed(1)} kg</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Scatter
                                  name="Battery"
                                  data={plotResults}
                                  fill="hsl(var(--accent))"
                                  fillOpacity={0.6}
                                  onClick={(data) => setSelectedSolution(data.payload)}
                                />
                              </ScatterChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                        </div>

                        <div className="text-sm text-muted-foreground text-center">
                          Showing {plotResults.length} configurations out of {totalConfigurations} total
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : showResults && results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                    <Battery className="w-16 h-16 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">
                      No valid configurations found.<br />Try adjusting your requirements.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                    <Battery className="w-16 h-16 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">
                      Enter your specifications and click<br />"Generate Design" to see results
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Free vs Pro Banner */}
      <section className="py-24 bg-muted/30">
        <div className="container px-4 mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Use our free version or unlock advanced features
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Get started with basic calculations for free, or upgrade for professional-grade tools
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Try Free Version
            </Button>
            <Button size="lg" asChild>
              <Link to="/pricing">Upgrade to Professional Version</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />

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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Configuration Details: {solution.cell.CellModelNo} ({solution.series_cells}S{solution.parallel_cells}P)</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 max-h-[70vh] overflow-y-auto p-2">
          {/* Column 1: Battery & Cell Specs */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Battery Specs</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Nominal Voltage:</strong> {solution.battery_voltage.toFixed(1)} V</p>
                <p><strong>Nominal Current:</strong> {nominalCurrent.toFixed(1)} A</p>
                <p><strong>Energy:</strong> {formatUnit(solution.battery_energy, 'Wh')}</p>
                <p><strong>Nominal Power:</strong> {formatUnit(nominalPower, 'W')}</p>
                <p><strong>Peak Power:</strong> {formatUnit(solution.peak_power, 'W')}</p>
                <p><strong>Weight:</strong> {solution.battery_weight.toFixed(2)} kg</p>
                <p className="font-bold">Total Price: €{solution.total_price.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Cell: {solution.cell.Brand} {solution.cell.CellModelNo}</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>Nominal Voltage:</strong> {solution.cell.NominalVoltage} V</p>
                <p><strong>Charge C-Rate:</strong> {solution.cell.MaxContinuousChargeRate}C</p>
                <p><strong>Discharge C-Rate:</strong> {solution.cell.MaxContinuousDischargeRate}C</p>
                <p><strong>Dimensions (mm):</strong> {solution.cell.Cell_Height}H x {solution.cell.Cell_Width}W x {solution.cell.Cell_Thickness}T</p>
                <p><strong>Weight:</strong> {solution.cell.Weight} g</p>
                <p><strong>Price:</strong> €{solution.cell.Price.toFixed(2)}</p>
                <AffiliateLink link={solution.cell.Connection} />
              </CardContent>
            </Card>
          </div>

          {/* Column 2 & 3: Components */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            {solution.fuse && (
              <Card>
                <CardHeader><CardTitle className="text-base">Fuse</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>Brand:</strong> {solution.fuse.brand}</p>
                  <p><strong>Model:</strong> {solution.fuse.model}</p>
                  <p><strong>Max Voltage:</strong> {solution.fuse.vdc_max} V</p>
                  <p><strong>Max Current:</strong> {solution.fuse.a_max} A</p>
                  <p><strong>Price:</strong> €{solution.fuse.price.toFixed(2)}</p>
                  <AffiliateLink link={solution.fuse.link} />
                </CardContent>
              </Card>
            )}
            {solution.relay && (
              <Card>
                <CardHeader><CardTitle className="text-base">Relay</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>Brand:</strong> {solution.relay.brand}</p>
                  <p><strong>Model:</strong> {solution.relay.model}</p>
                  <p><strong>Max Voltage:</strong> {solution.relay.vdc_max} V</p>
                  <p><strong>Max Current:</strong> {solution.relay.a_max} A</p>
                  <p><strong>Price:</strong> €{solution.relay.price.toFixed(2)}</p>
                  <AffiliateLink link={solution.relay.link} />
                </CardContent>
              </Card>
            )}
            {solution.bms && (
              <Card>
                <CardHeader><CardTitle className="text-base">BMS</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>Brand:</strong> {solution.bms.brand}</p>
                  <p><strong>Model:</strong> {solution.bms.model}</p>
                  <p><strong>Max Cells:</strong> {solution.bms.max_cells}</p>
                  <p><strong>Max Current:</strong> {solution.bms.a_max} A</p>
                  <p><strong>Price:</strong> €{solution.bms.master_price.toFixed(2)}</p>
                  <AffiliateLink link={solution.bms.link} />
                </CardContent>
              </Card>
            )}
            {solution.shunt && (
              <Card>
                <CardHeader><CardTitle className="text-base">Shunt</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>Brand:</strong> {solution.shunt.brand}</p>
                  <p><strong>Model:</strong> {solution.shunt.model}</p>
                  <p><strong>Max Voltage:</strong> {solution.shunt.vdc_max} V</p>
                  <p><strong>Max Current:</strong> {solution.shunt.a_max} A</p>
                  <p><strong>Price:</strong> €{solution.shunt.price.toFixed(2)}</p>
                  <AffiliateLink link={solution.shunt.link} />
                </CardContent>
              </Card>
            )}
            {solution.cable && (
              <Card>
                <CardHeader><CardTitle className="text-base">Cable</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>Model:</strong> {solution.cable.model}</p>
                  <p><strong>Section:</strong> {solution.cable.section} mm²</p>
                  <p><strong>Price:</strong> €{solution.cable.price.toFixed(2)}</p>
                  <AffiliateLink link={solution.cable.link} />
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