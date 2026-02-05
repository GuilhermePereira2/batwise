import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Battery, Zap, Calculator, Sparkles, Loader2, ExternalLink, AlertTriangle, Lock, CheckCircle, CircuitBoard, ChevronDown, ChevronUp, Upload, FileDown, Database, FileSpreadsheet, FileText, DollarSign, Download, Trash2 } from "lucide-react";
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
import { useAuth } from "@/context/AuthContext";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { USE_CASES } from "@/lib/presets";
import { saveFileLocal, getFileLocal, removeFileLocal } from '@/lib/localDB';

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
  slave_price?: number;
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
    try {
      const result = configs.reduce((best, current) => {
        const bestMetric = metric(best);
        const currentMetric = metric(current);
        // Skip invalid metrics (NaN, Infinity, etc.)
        if (!isFinite(bestMetric) || !isFinite(currentMetric)) return best;
        return (compare === 'max' ? currentMetric > bestMetric : currentMetric < bestMetric) ? current : best;
      });
      return result;
    } catch (e) {
      console.warn('Error in findBest:', e);
      return null;
    }
  };

  const calculateOptimalScore = (config: Configuration) => {
    if (!config.safety.is_safe) return 0;
    const energyDensity = config.battery_energy / config.battery_weight;
    const maxEnergyDensity = Math.max(...configs.map(c => c.battery_energy / c.battery_weight));
    if (!isFinite(maxEnergyDensity)) return 0;
    const normalizedDensity = energyDensity / maxEnergyDensity;
    const priceDifference = Math.abs(config.total_price - targetPrice);
    const maxPriceDiff = Math.max(...configs.map(c => Math.abs(c.total_price - targetPrice)));
    const normalizedPrice = maxPriceDiff > 0 ? 1 - (priceDifference / maxPriceDiff) : 0;
    return (normalizedDensity + normalizedPrice + (config.safety.safety_score / 100)) / 3;
  };

  const results = [
    { title: "Lowest Price", config: findBest(c => c.total_price, 'min'), metric: (c: Configuration) => `$${c.total_price.toFixed(2)}` },
    { title: "Highest Energy", config: findBest(c => c.battery_energy), metric: (c: Configuration) => formatUnit(c.battery_energy, 'Wh') },
    { title: "Highest Energy Density", config: findBest(c => c.battery_energy / c.battery_weight), metric: (c: Configuration) => `${(c.battery_energy / c.battery_weight).toFixed(1)} Wh/kg` },
    { title: "Best Value", config: findBest(c => c.total_price / c.battery_energy), metric: (c: Configuration) => `${(c.total_price / c.battery_energy).toFixed(1)} $/Wh` },
    { title: "Lightest", config: findBest(c => c.battery_weight, 'min'), metric: (c: Configuration) => `${c.battery_weight.toFixed(1)} kg` },
    { title: "Optimal Balance", config: findBest(c => calculateOptimalScore(c)), metric: (c: Configuration) => `${(c.battery_energy / c.battery_weight).toFixed(1)} Wh/kg @ $${c.total_price.toFixed(0)}` }
  ];

  // Filter out any results with undefined config
  return results.filter(r => r.config !== null && r.config !== undefined);
};

// --- HELPER PARA DOWNLOAD DE TEMPLATES CSV ---
const downloadCsvTemplate = (type: string) => {
  let headers = "";
  let filename = `${type}_template.csv`;

  switch (type) {
    case 'cells':
      headers = "Brand,CellModelNo,NominalVoltage,ChargeVoltage,Capacity,MaxContinuousDischargeRate,MaxContinuousChargeRate,PeakDischargeCurrent,PeakChargeCurrent,Weight,Resistance,Price,Cell_Height,Cell_Width,Cell_Thickness,Cycles";
      break;
    case 'bms':
      headers = "brand,model,price,vdc_max,vdc_min,a_max,max_cells";
      break;
    case 'relays':
      headers = "brand,model,price,vdc_max,a_max";
      break;
    case 'fuses':
      headers = "brand,model,price,vdc_max,a_max";
      break;
    case 'cables':
      headers = "brand,model,price,section_mm2,vdc_max,a_max";
      break;
    case 'shunts':
      headers = "brand,model,price,vdc_max,a_max";
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

  const { isAuthenticated, user, token, updateCredits } = useAuth();
  const { toast } = useToast();

  // Debug: Monitor customFiles state
  useEffect(() => {
    console.log('📁 customFiles state changed:', customFiles);
  }, [customFiles]);

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

  useEffect(() => {
    const userId = user?.id || user?.email;
    console.log('🔄 DIYTool mounted/updated - Auth:', isAuthenticated, 'User ID:', userId);
    
    if (!isAuthenticated || !userId) {
      console.log('⏸️ Skipping file load - not authenticated or no user ID');
      return;
    }

    const loadLocalFiles = async () => {
      console.log('📂 Starting to load local files for user:', userId);
      const types = ['cells', 'bms', 'relays', 'cables', 'shunts', 'fuses'];
      const loadedFiles: any = {};

      for (const type of types) {
        try {
          const file = await getFileLocal(userId, type);
          if (file) {
            loadedFiles[type] = file;
            console.log(`✅ Loaded ${type}:`, file.name, file.size, 'bytes');
          } else {
            console.log(`⚪ No ${type} file found in IndexedDB`);
          }
        } catch (e) {
          console.error(`❌ Error loading ${type}:`, e);
        }
      }

      const fileCount = Object.keys(loadedFiles).length;
      console.log(`📊 Total files loaded: ${fileCount}`, loadedFiles);

      if (fileCount > 0) {
        setCustomFiles(prev => {
          const updated = { ...prev, ...loadedFiles };
          console.log('📝 Updated customFiles state:', updated);
          return updated;
        });
        toast({
          title: "Session Restored",
          description: `Loaded ${fileCount} file(s) from previous session.`,
        });
      } else {
        console.log('ℹ️ No files to restore');
      }
    };

    loadLocalFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, user?.email]);

  const handleFileChange = async (type: string, file: File | null) => {
    setCustomFiles(prev => ({ ...prev, [type]: file }));

    if (file) {
      toast({ title: "File Attached", description: `${file.name} loaded for ${type}.` });
      
      const userId = user?.id || user?.email;
      if (userId) {
        try {
          await saveFileLocal(userId, type, file);
          console.log(`💾 Saved ${type} to IndexedDB:`, file.name);
        } catch (error) {
          console.error(`❌ Error saving ${type}:`, error);
          toast({ 
            title: "Save Error", 
            description: `Failed to save ${type} file.`,
            variant: "destructive"
          });
        }
      }
    }
  };

  const handleRemoveFile = async (type: string) => {
    setCustomFiles(prev => ({ ...prev, [type]: null }));
    const userId = user?.id || user?.email;
    if (userId) {
      await removeFileLocal(userId, type);
      toast({ title: "File Removed", description: `Cleared ${type} data.` });
    }
  };

  const handleGenerate = async () => {
    if (dataSource === 'custom') {
      if (!isAuthenticated || !user) {
        toast({
          title: "Access Restricted",
          description: "Please log in to use your custom component database.",
          variant: "destructive"
        });
        return;
      }

      if (user.credits <= 0) {
        toast({
          title: "Insufficient Credits",
          description: "You have 0 credits. Please contact support.",
          variant: "destructive"
        });
        return;
      }
    }

    setIsLoading(true);
    setShowResults(false);
    setResults([]);

    try {
      const configData = {
        min_voltage: Number(minVoltage) || 70,
        max_voltage: Number(maxVoltage) || 80,
        min_continuous_power: Number(minContinuousPower) || 2000,
        peak_power: Number(peakPower) || (Number(minContinuousPower) * 1),
        min_energy: Number(minEnergy) || 3000,
        max_weight: Number(maxWeight) || 100,
        max_price: Number(maxPrice) || 100000,
        max_width: Number(maxWidth) || 2000,
        max_length: Number(maxLength) || 10000,
        max_height: Number(maxHeight) || 2000,
        target_price: Number(targetPrice) || 0,
        ambient_temp: 25,
        include_components: includeComponents,
        debug: true,
      };

      const url = getApiUrl("calculate");
      const formData = new FormData();

      formData.append('config', JSON.stringify(configData));

      if (dataSource === 'custom') {
        formData.append('use_custom_db', 'true');
        Object.entries(customFiles).forEach(([key, file]) => {
          if (file) formData.append(key, file);
        });
      } else {
        formData.append('use_custom_db', 'false');
      }

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403) {
          throw new Error("Insufficient credits to perform this calculation.");
        }
        throw new Error(`Server Error: ${errorText}`);
      }

      const data = await response.json();

      if (data.remaining_credits !== undefined && data.remaining_credits !== null) {
        updateCredits(data.remaining_credits);
        toast({
          title: "Credits Updated",
          description: `Calculation successful. You have ${data.remaining_credits} credits left.`,
          variant: "default",
          className: "bg-green-50 border-green-200 text-green-800"
        });
      }

      const newResults = data.results || [];
      setResults(newResults);
      setPlotResults(data.plotResults || []);
      setTotalConfigurations(data.total || 0);
      setShowResults(true);

      if (data.total === 0) {
        toast({
          title: "No solutions found",
          description: "Try relaxing constraints. (No credits were deducted)",
          variant: "destructive"
        });
      } else if (data.total < 2 && dataSource === 'custom') {
        toast({
          title: "Few solutions found",
          description: `Only ${data.total} solution found. No credits deducted (minimum 2 required for deduction).`,
          variant: "default"
        });
      } else {
        toast({
          title: "Success!",
          description: `Found ${data.total} configurations.`,
        });
        setTimeout(() => {
          document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "Calculation Failed",
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
                  <Tabs
                    value={dataSource}
                    onValueChange={(v) => setDataSource(v as 'default' | 'custom')}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="default" className="text-xs">Watt Builder Database</TabsTrigger>
                      <TabsTrigger value="custom" className="text-xs flex items-center gap-2">
                        {!isAuthenticated && <Lock className="w-3 h-3 text-muted-foreground" />}
                        My Database
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>

                <CardContent className="space-y-6">

                  {/* CUSTOM DB UPLOAD FIELDS */}
                  {dataSource === 'custom' && isAuthenticated && (
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
                            
                            {customFiles[item.id] ? (
                              <div className="flex items-center justify-between h-8 px-3 text-xs bg-blue-50 border border-blue-200 rounded text-blue-700 animate-in fade-in">
                                  <span className="truncate flex items-center gap-2">
                                    <CheckCircle className="w-3 h-3" /> 
                                    {customFiles[item.id]?.name || "Loaded"}
                                  </span>
                                  <button 
                                      onClick={() => handleRemoveFile(item.id)}
                                      className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                                      type="button"
                                  >
                                      <Trash2 className="w-3 h-3" />
                                  </button>
                              </div>
                            ) : (
                              <Input
                                id={item.id}
                                type="file"
                                accept=".csv"
                                className="h-8 text-xs file:text-xs"
                                onChange={(e) => handleFileChange(item.id, e.target.files?.[0] || null)}
                              />
                            )}
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

                  {dataSource === 'custom' && !isAuthenticated && (
                    <div className="p-4 border border-dashed rounded-lg bg-slate-50 text-sm text-muted-foreground flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Log in to upload and use your own component database for free.
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
                      <Label htmlFor="minEnergy">
                        Min Energy (Wh)
                        <InfoTooltip content="Defines autonomy (range/runtime). Nominal Voltage x Ah = Wh." />
                      </Label>
                      <Input id="minEnergy" type="number" value={minEnergy} onChange={(e) => setMinEnergy(e.target.value)} placeholder="e.g., 2000" />
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
                        placeholder="Optional"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="minContinuousPower">
                        Continuous Power (W)
                        <InfoTooltip content="Average power consumption. Used for thermal safety calculations." />
                      </Label>
                      <Input id="minContinuousPower" type="number" value={minContinuousPower} onChange={(e) => setMinContinuousPower(e.target.value)} placeholder="e.g., 3000" />
                    </div>

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
                          {findBestConfigurations(results, Number(targetPrice) || 0).map(({ title, config, metric }, idx) => {
                            if (!config) return null;
                            return (
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
                            );
                          })}
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
                                <SelectItem value="total_price">Price ($)</SelectItem>
                                <SelectItem value="battery_energy">Energy (Wh)</SelectItem>
                                <SelectItem value="battery_weight">Weight (kg)</SelectItem>
                                <SelectItem value="continuous_power">Power (W)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex-1 w-full min-h-[400px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                              <XAxis 
                                type="number" 
                                dataKey={xAxis} 
                                name={xAxis.replace('_', ' ')} 
                                unit={xAxis.includes('price') ? '$' : ''} 
                                label={{ value: xAxis.replace('_', ' '), position: 'bottom', offset: 0 }}
                              />
                              <YAxis 
                                type="number" 
                                dataKey={yAxis} 
                                name={yAxis.replace('_', ' ')} 
                                unit={yAxis.includes('price') ? '$' : ''} 
                                label={{ value: yAxis.replace('_', ' '), angle: -90, position: 'left' }}
                              />
                              <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-background border p-2 rounded shadow-lg text-xs">
                                      <p className="font-bold">{data.cell.CellModelNo}</p>
                                      <p>{data.series_cells}S {data.parallel_cells}P</p>
                                      <p>Energy: {formatUnit(data.battery_energy, 'Wh')}</p>
                                      <p>Price: ${data.total_price.toFixed(2)}</p>
                                      <p>Safety: {data.safety.safety_score}%</p>
                                    </div>
                                  );
                                }
                                return null;
                              }} />
                              <Scatter 
                                name="Configurations" 
                                data={plotResults} 
                                shape={<CustomScatterDot />}
                                onClick={(data) => setSelectedSolution(data.payload)}
                              />
                            </ScatterChart>
                          </ResponsiveContainer>
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
          dataSource={dataSource}
        />
      )}
    </div>
  );
};

// --- SOLUTION DETAIL MODAL ---
const SolutionDetailModal = ({ solution, isOpen, onClose, showComponents, dataSource }: { solution: Configuration, isOpen: boolean, onClose: () => void, showComponents: boolean, dataSource: 'default' | 'custom' }) => {
  if (!solution) return null;

  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
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

  const requireAuthForDownload = (action: () => void) => {
    if (!isAuthenticated) {
      toast({
        title: "Login required",
        description: "Log in to download documents.",
        variant: "destructive",
      });
      return;
    }

    action();
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

  // --- FUNÇÃO PARA GERAR PDF ---
  const downloadDatasheet_pdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // Helper para adicionar linhas de texto
    const addLine = (label: string, value: string, isBold: boolean = false) => {
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(label, margin, y);

      doc.setFont("helvetica", "normal");
      doc.text(value, margin + 60, y);
      y += 7;
    };

    // Helper para Títulos de Secção
    const addSectionTitle = (title: string) => {
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(249, 115, 22); // Laranja da marca
      doc.text(title.toUpperCase(), margin, y);
      doc.setDrawColor(249, 115, 22);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 10;
    };

    // --- HEADER ---
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("Watt Builder", margin, y);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Technical Datasheet", margin, y + 6);

    const dateStr = new Date().toLocaleDateString();
    doc.text(dateStr, pageWidth - margin - 20, y);

    y += 20;

    // --- PROJECT SUMMARY ---
    addSectionTitle("Project Summary");
    addLine("Configuration:", `${solution.series_cells}S ${solution.parallel_cells}P`, true);
    addLine("Cell Model:", `${solution.cell.Brand} ${solution.cell.CellModelNo}`);
    addLine("Total Cells:", `${solution.series_cells * solution.parallel_cells} units`);

    // --- ELECTRICAL SPECS ---
    addSectionTitle("Electrical Specifications");
    addLine("Nominal Voltage:", `${solution.battery_voltage.toFixed(1)} V`);
    addLine("Capacity:", `${solution.battery_capacity.toFixed(1)} Ah`);
    addLine("Total Energy:", formatUnit(solution.battery_energy, 'Wh'));
    addLine("Max Cont. Power:", formatUnit(solution.continuous_power, 'W'));
    addLine("Peak Power (30s):", formatUnit(solution.peak_power, 'W'));

    // --- MECHANICAL SPECS ---
    addSectionTitle("Mechanical Specifications");
    addLine("Total Weight (Cells):", `${solution.battery_weight.toFixed(2)} kg`);
    addLine("Cell Dimensions:", `${solution.cell.Cell_Width} x ${solution.cell.Cell_Height} mm`);

    // --- COMPONENTS ---
    addSectionTitle("Key Components");
    addLine("BMS:", solution.bms ? `${solution.bms.brand} ${solution.bms.model} (${solution.bms.a_max}A)` : "N/A");
    addLine("Fuse:", solution.fuse ? `${solution.fuse.brand} (${solution.fuse.a_max}A)` : "N/A");
    addLine("Relay:", solution.relay ? `${solution.relay.brand} (${solution.relay.a_max}A)` : "N/A");
    addLine("Cable:", solution.cable ? `${solution.cable.brand} (${solution.cable.section}mm²)` : "N/A");

    // --- SAFETY ---
    addSectionTitle("Safety Assessment");
    const scoreColor = solution.safety.is_safe ? [34, 197, 94] : [239, 68, 68];
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text(`Safety Score: ${solution.safety.safety_score}/100`, margin, y);
    y += 7;

    if (solution.safety.warnings.length > 0) {
      doc.setTextColor(200, 50, 50);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      solution.safety.warnings.forEach(warn => {
        const splitText = doc.splitTextToSize(`- ${warn}`, pageWidth - (margin * 2));
        doc.text(splitText, margin, y);
        y += (splitText.length * 5);
      });
    } else {
      doc.setTextColor(0, 0, 0);
      doc.text("No critical warnings detected.", margin, y);
      y += 7;
    }

    // --- DISCLAIMER (Footer) ---
    y = 270;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Disclaimer: This datasheet is generated automatically by Watt Builder algorithms.", margin, y);
    doc.text("Values are theoretical estimates. Always consult a professional before assembly.", margin, y + 4);

    doc.save(`Datasheet_${solution.series_cells}S${solution.parallel_cells}P_${solution.cell.CellModelNo}.pdf`);
  };

  // --- DATASHEET GENERATOR ---
  const downloadDatasheet_txt = () => {
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
        {dataSource === 'default' && solution.safety.warnings.length > 0 && (
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
                <Button variant="outline" className="w-full justify-start h-9" onClick={() => requireAuthForDownload(downloadBOM)}>
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                  Download BOM (Excel/CSV)
                  {!isAuthenticated && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
                </Button>
                <Button variant="outline" className="w-full justify-start h-9" onClick={() => requireAuthForDownload(downloadDatasheet_txt)}>
                  <FileText className="w-4 h-4 mr-2 text-blue-600" />
                  Download Datasheet (txt)
                  {!isAuthenticated && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
                </Button>
                <Button variant="outline" className="w-full justify-start h-9" onClick={() => requireAuthForDownload(downloadDatasheet_pdf)}>
                  <FileText className="w-4 h-4 mr-2 text-red-600" />
                  Download Datasheet (PDF)
                  {!isAuthenticated && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
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
                    <AffiliateLink link={solution.fuse.link} />
                  </CardContent>
                </Card>
              )}
              {solution.relay && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Relay</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>Model:</strong> {solution.relay.brand} {solution.relay.model}</p>
                    <p><strong>Rating:</strong> {solution.relay.a_max}A / {solution.relay.vdc_max}V</p>
                    <p><strong>Price:</strong> ${solution.relay.price.toFixed(2)}</p>
                    <AffiliateLink link={solution.relay.link} />
                  </CardContent>
                </Card>
              )}
              {solution.cable && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Cabling</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>Model:</strong> {solution.cable.brand} {solution.cable.model}</p>
                    <p><strong>Cross Section:</strong> {solution.cable.section} mm²</p>
                    <p><strong>Rating:</strong> {solution.cable.a_max} A / {solution.cable.vdc_max} V</p>
                    <AffiliateLink link={solution.cable.link} />
                  </CardContent>
                </Card>
              )}

              {solution.shunt && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Shunt</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>Model:</strong> {solution.shunt.brand} {solution.shunt.model}</p>
                    <p><strong>Rating:</strong> {solution.shunt.a_max} A / {solution.shunt.vdc_max} V</p>
                    <AffiliateLink link={solution.shunt.link} />
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