import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ArrowRight, Battery, Zap, Calculator, Sparkles, Loader2, AlertTriangle, Lock, CheckCircle, FileDown, Download, Trash2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartTooltip } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { WiringDiagram } from "@/components/WiringDiagram";
import { getApiUrl } from "@/lib/config";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { useToast } from "@/hooks/use-toast";
import { USE_CASES } from "@/lib/presets";
import { saveFileLocal, getFileLocal, removeFileLocal } from "@/lib/localDB";
import type { Configuration } from "./diytool/types";
import { formatUnit, findBestConfigurations, downloadCsvTemplate } from "./diytool/utils";
import { SolutionDetailModal } from "./diytool/SolutionDetailModal";

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

export default DIYTool;