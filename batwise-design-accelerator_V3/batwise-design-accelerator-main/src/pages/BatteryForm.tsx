import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/ui/InfoTooltip"; // O componente que criaste acima
import { USE_CASES } from "@/lib/presets";

// --- TIPAGEM DOS DADOS (Coincide com o teu Python) ---
interface SafetyAssessment {
  is_safe: bool;
  safety_score: number;
  warnings: string[];
  recommendations: string[];
}

interface ComponentData {
  brand: string;
  model: string;
  price: number;
}

interface Configuration {
  cell: { Brand: string; CellModelNo: string; Chemistry: string }; // Simplificado
  series_cells: number;
  parallel_cells: number;
  battery_voltage: number;
  battery_capacity: number;
  battery_energy: number;
  continuous_power: number;
  total_price: number;
  safety: SafetyAssessment; // O novo campo crítico
  bms: ComponentData;
  fuse: ComponentData;
}


const BatteryForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Configuration[]>([]); // Estado para guardar resultados
  const [useCase, setUseCase] = useState("custom");

  const [formData, setFormData] = useState({
    maxWeight: "",
    minEnergy: "",
    minVoltage: "",
    maxVoltage: "",
    minPower: "",
    maxLength: "",
    maxWidth: "",
    maxHeight: "",
    maxPrice: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Função para aplicar Presets
  const handlePresetChange = (value: string) => {
    setUseCase(value);
    const preset = USE_CASES[value];
    if (preset && preset.values) {
      setFormData((prev) => ({ ...prev, ...preset.values }));
      toast({ title: "Preset Applied", description: `Values updated for ${preset.label}` });
    }
  };

  const isFormValid = () => {
    // Validação simples: campos obrigatórios preenchidos
    return Object.values(formData).some((value) => value.trim() !== "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResults([]); // Limpa resultados anteriores

    // Prepara payload (converte para numeros)
    const payload = {
      min_energy: Number(formData.minEnergy) || 0,
      min_continuous_power: Number(formData.minPower) || 0,
      min_voltage: Number(formData.minVoltage) || 0,
      max_voltage: Number(formData.maxVoltage) || 0,
      max_width: Number(formData.maxWidth) * 1000 || 10000, // m -> mm, default alto se vazio
      max_length: Number(formData.maxLength) * 1000 || 10000,
      max_height: Number(formData.maxHeight) * 1000 || 10000,
      max_weight: Number(formData.maxWeight) || 1000,
      max_price: Number(formData.maxPrice) || 10000,
      ambient_temp: 25
    };

    try {
      const response = await fetch('http://localhost:8000/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();

      // O Python retorna { results: [...], ... } ou lista direta? 
      // Baseado no teu logic.py return, é um dict: { "results": configs... }
      const configs = data.results || [];

      if (configs.length === 0) {
        toast({ title: "No Solutions Found", description: "Try relaxing your constraints (size, weight or price).", variant: "destructive" });
      } else {
        setResults(configs);
        toast({ title: "Success!", description: `${configs.length} valid designs found.` });

        // Scroll automático para os resultados
        setTimeout(() => {
          document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }

    } catch (error) {
      console.error("Erro:", error);
      toast({ title: "Connection Error", description: "Ensure Python backend is running.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container px-4 py-12 mx-auto max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">Battery Wizard</h1>
          <p className="text-lg text-muted-foreground">
            Design safe, professional-grade battery packs in seconds.
          </p>
        </div>

        {/* --- STEP 1: PRESETS --- */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
          <Label className="text-lg font-semibold mb-2 block">1. What are you building?</Label>
          <Select onValueChange={handlePresetChange} value={useCase}>
            <SelectTrigger className="w-full md:w-1/2 bg-white">
              <SelectValue placeholder="Select a project type" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(USE_CASES).map(([key, data]) => (
                <SelectItem key={key} value={key}>{data.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* --- STEP 2: FORM --- */}
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid md:grid-cols-2 gap-6">

            {/* Voltage Section */}
            <div className="space-y-4 p-4 border rounded-lg bg-card">
              <h3 className="font-semibold text-primary flex items-center">
                Voltage & Power


                [Image of battery series vs parallel wiring diagram]

              </h3>

              <div className="space-y-2">
                <Label>Minimum Voltage (V) <InfoTooltip content="Voltage at 0% charge. Don't go below this or the BMS will cut off." /></Label>
                <Input name="minVoltage" type="number" step="0.1" value={formData.minVoltage} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label>Maximum Voltage (V) <InfoTooltip content="Voltage at 100% charge. Must match your charger and controller limit." /></Label>
                <Input name="maxVoltage" type="number" step="0.1" value={formData.maxVoltage} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label>Continuous Power (W) <InfoTooltip content="The wattage your motor/inverter pulls constantly. Peak power is calculated automatically." /></Label>
                <Input name="minPower" type="number" step="1" value={formData.minPower} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label>Min Energy (Wh) <InfoTooltip content="Determines your range/runtime. More Wh = More Distance." /></Label>
                <Input name="minEnergy" type="number" value={formData.minEnergy} onChange={handleChange} required />
              </div>
            </div>

            {/* Constraints Section */}
            <div className="space-y-4 p-4 border rounded-lg bg-card">
              <h3 className="font-semibold text-primary">Physical Limits</h3>

              <div className="space-y-2">
                <Label>Max Length (m)</Label>
                <Input name="maxLength" type="number" step="0.01" value={formData.maxLength} onChange={handleChange} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Max Width (m)</Label>
                <Input name="maxWidth" type="number" step="0.01" value={formData.maxWidth} onChange={handleChange} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Max Height (m) <InfoTooltip content="Critical for skateboards or slim cases." /></Label>
                <Input name="maxHeight" type="number" step="0.01" value={formData.maxHeight} onChange={handleChange} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Max Price (€)</Label>
                <Input name="maxPrice" type="number" value={formData.maxPrice} onChange={handleChange} />
              </div>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating Safe Designs...</> : "Find My Battery"}
          </Button>
        </form>

        {/* --- STEP 3: RESULTS & SAFETY WARNINGS --- */}
        {results.length > 0 && (
          <div id="results-section" className="mt-16 space-y-6 animate-in fade-in slide-in-from-bottom-10">
            <h2 className="text-3xl font-bold">Recommended Builds</h2>
            <p className="text-muted-foreground">Ranked by Value (Energy / €) and Safety.</p>

            <div className="grid gap-6">
              {results.map((res, index) => (
                <Card key={index} className={`border-l-4 ${res.safety.safety_score < 50 ? 'border-l-red-500' : 'border-l-emerald-500'} shadow-md hover:shadow-lg transition-shadow`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          {res.series_cells}S{res.parallel_cells}P with {res.cell.Brand}
                          {/* Badge de Melhor Valor */}
                          {index === 0 && <Badge className="bg-emerald-600">Best Value</Badge>}
                        </CardTitle>
                        <CardDescription>{res.cell.CellModelNo} • {res.battery_energy} Wh • {res.battery_voltage}V Nominal</CardDescription>
                      </div>

                      {/* Safety Score Display */}
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${res.safety.safety_score >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {res.safety.safety_score}/100
                        </div>
                        <div className="text-xs text-muted-foreground">Safety Score</div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      {/* Technical Specs */}
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Configuration:</span> <span className="font-mono">{res.series_cells} Series / {res.parallel_cells} Parallel</span></div>
                        <div className="flex justify-between"><span>Max Power:</span> <span className="font-mono">{res.continuous_power} W</span></div>
                        <div className="flex justify-between"><span>Total Weight:</span> <span className="font-mono">{res.battery_weight} kg</span></div>
                        <div className="flex justify-between font-bold mt-2 pt-2 border-t"><span>Est. Price:</span> <span>€{res.total_price}</span></div>
                      </div>

                      {/* BOM (Materials) */}
                      <div className="bg-slate-50 p-3 rounded text-sm space-y-1">
                        <p className="font-semibold text-xs uppercase text-slate-500 mb-1">Required Components</p>
                        <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-600" /> BMS: {res.bms.brand} ({res.bms.model})</div>
                        <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-600" /> Fuse: {res.fuse.model}</div>
                        <div className="text-xs text-blue-600 mt-2 hover:underline cursor-pointer">View Wiring Diagram</div>
                      </div>
                    </div>

                    {/* --- AVISOS DE SEGURANÇA (CRÍTICO) --- */}
                    {res.safety.warnings.length > 0 && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
                        <div className="flex items-center gap-2 font-bold mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          Safety Advisory
                        </div>
                        <ul className="list-disc pl-5 space-y-1">
                          {res.safety.warnings.map((warn, i) => (
                            <li key={i}>{warn}</li>
                          ))}
                        </ul>
                        {/* Recomendações */}
                        {res.safety.recommendations.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-amber-200">
                            <span className="font-semibold text-xs uppercase text-amber-700">How to fix:</span>
                            <ul className="list-disc pl-5 mt-1 text-amber-800">
                              {res.safety.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {res.safety.safety_score === 0 && (
                      <div className="mt-2 p-2 bg-red-100 text-red-700 text-xs font-bold text-center rounded border border-red-300 flex items-center justify-center gap-2">
                        <Flame className="w-4 h-4" /> DO NOT BUILD THIS - FIRE RISK
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatteryForm;