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

const DIYTool = () => {
  const USE_LOCAL_FUNCTIONS = import.meta.env.VITE_USE_LOCAL_FUNCTIONS === 'true';
  const LOCAL_BATTERY_FUNCTION_URL = import.meta.env.VITE_BATTERY_DESIGN_URL || 'http://localhost:8000';
  const [minVoltage, setMinVoltage] = useState("");
  const [maxVoltage, setMaxVoltage] = useState("");
  const [maxPower, setMaxPower] = useState("");
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
  const [results, setResults] = useState<any[]>([]);
  const [plotResults, setPlotResults] = useState<any[]>([]);
  const [totalConfigurations, setTotalConfigurations] = useState(0);
  const [xAxis, setXAxis] = useState("battery_energy");
  const [yAxis, setYAxis] = useState("total_price");
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsLoading(true);
    setShowResults(false);

    try {
      let data: any = null;
      let error: any = null;

      const payload = {
        min_voltage: minVoltage || '80',
        max_voltage: maxVoltage || '90',
        max_power: maxPower || '10000',
        min_energy: minEnergy || '3000',
        max_weight: maxWeight || '65',
        max_price: maxPrice || '5000',
        max_width: maxWidth || '900',
        max_length: maxLength || '340',
        max_height: maxHeight || '250',
        debug: true,
      };

      if (USE_LOCAL_FUNCTIONS) {
        // Call local Deno function directly
        const res = await fetch(LOCAL_BATTERY_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          error = await res.text();
        } else {
          data = await res.json();
        }
      } else {
        const invokeRes = await supabase.functions.invoke('battery-design', { body: payload });
        data = invokeRes.data;
        error = invokeRes.error;
      }

      if (error) throw error;

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
          description: `Found ${data.total} valid configurations. Showing top ${data.results.length}.`,
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

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Input Panel */}
            <Card className="shadow-soft animate-slide-up">
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
                    <Label htmlFor="maxPower">Maximum Power (W)</Label>
                    <Input
                      id="maxPower"
                      type="number"
                      placeholder="e.g., 5000"
                      value={maxPower}
                      onChange={(e) => setMaxPower(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">(Maximum power sustained for 30 seconds)</p>
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
            <Card className="shadow-soft animate-slide-up" style={{ animationDelay: "100ms" }}>
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
                        Found {totalConfigurations} valid configurations. Showing top 30 in table, top 100 in plot.
                      </p>
                    </div>

                    <Tabs defaultValue="table" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="table" className="flex items-center gap-2">
                          <Table2 className="w-4 h-4" />
                          Table View
                        </TabsTrigger>
                        <TabsTrigger value="plot" className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          Plot View
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="table" className="space-y-4">
                        <div className="p-3 bg-accent/10 rounded-lg border border-accent/20 mb-4">
                          <p className="text-sm text-muted-foreground">
                            * O peso apresentado não considera eletrónica nem caixa
                          </p>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Cell</TableHead>
                                <TableHead className="text-center">Config</TableHead>
                                <TableHead className="text-right">Energy</TableHead>
                                <TableHead className="text-right">Weight*</TableHead>
                                <TableHead>Fuse</TableHead>
                                <TableHead>Relay</TableHead>
                                <TableHead>Cable</TableHead>
                                <TableHead>BMS</TableHead>
                                <TableHead>Shunt</TableHead>
                                <TableHead className="text-right">Total €</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {results.map((config, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1">
                                        {config.cell_model}
                                        {config.cell_link && (
                                          <a href={config.cell_link} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80">
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">{config.brand}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="text-sm">{config.series_cells}S{config.parallel_cells}P</div>
                                    <div className="text-xs text-muted-foreground">{config.battery_voltage.toFixed(1)}V</div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="text-sm">{config.battery_energy} Wh</div>
                                    <div className="text-xs text-muted-foreground">{config.battery_capacity.toFixed(1)}Ah</div>
                                  </TableCell>
                                  <TableCell className="text-right">{config.battery_weight.toFixed(1)} kg</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 text-sm">
                                      {config.fuse_model}
                                      {config.fuse_link && (
                                        <a href={config.fuse_link} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80">
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">€{config.fuse_price}</div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 text-sm">
                                      {config.relay_model}
                                      {config.relay_link && (
                                        <a href={config.relay_link} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80">
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">€{config.relay_price}</div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 text-sm">
                                      {config.cable_section}mm²
                                      {config.cable_link && (
                                        <a href={config.cable_link} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80">
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">€{config.cable_price}/m</div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 text-sm">
                                      {config.bms_model}
                                      {config.bms_link && (
                                        <a href={config.bms_link} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80">
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">€{config.bms_price}</div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 text-sm">
                                      {config.shunt_model}
                                      {config.shunt_link && (
                                        <a href={config.shunt_link} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80">
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">€{config.shunt_price}</div>
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">€{config.total_price.toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
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

                      <TabsContent value="plot" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
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
                                <SelectItem value="cells_price">Cells Price (€)</SelectItem>
                                <SelectItem value="peak_power">Peak Power (W)</SelectItem>
                                <SelectItem value="impedance">Impedance (Ω)</SelectItem>
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
                                <SelectItem value="cells_price">Cells Price (€)</SelectItem>
                                <SelectItem value="peak_power">Peak Power (W)</SelectItem>
                                <SelectItem value="impedance">Impedance (Ω)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="h-[400px] w-full">
                          <ChartContainer config={{
                            battery: {
                              label: "Battery Configuration",
                              color: "hsl(var(--accent))",
                            },
                          }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  type="number"
                                  dataKey={xAxis}
                                  name={xAxis}
                                  label={{ value: xAxis.replace('_', ' ').toUpperCase(), position: 'insideBottom', offset: -10 }}
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
                                          <p className="font-semibold">{data.cell_model}</p>
                                          <p className="text-sm text-muted-foreground">{data.series_cells}S{data.parallel_cells}P</p>
                                          <p className="text-sm">Energy: {data.battery_energy} Wh</p>
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
    </div>
  );
};

export default DIYTool;
