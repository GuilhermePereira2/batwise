import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { USE_CASES } from "@/lib/presets";
import { SeoHead } from '../components/SeoHead';

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
}

interface Configuration {
  cell: { Brand: string; CellModelNo: string; Chemistry: string };
  series_cells: number;
  parallel_cells: number;
  battery_voltage: number;
  battery_capacity: number;
  battery_energy: number;
  continuous_power: number;
  battery_weight: number;
  total_price: number;
  safety: SafetyAssessment;
  bms: ComponentData;
  fuse: ComponentData;
}

const BatteryForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Configuration[]>([]);
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
    const { name, value, type } = e.target;
    
    if (type === 'number' && Number(value) < 0) {
      toast({
        title: 'Valor Inválido',
        description: 'O valor não pode ser negativo. Por favor, corrija o valor.',
        variant: 'destructive',
      });
      return;
    }
    
    setFormData({ ...formData, [name]: value });
  };

  const handlePresetChange = (value: string) => {
    setUseCase(value);
    const preset = USE_CASES[value as keyof typeof USE_CASES];
    if (preset && preset.values) {
      setFormData((prev) => ({ ...prev, ...preset.values }));
      toast({
        title: t('batteryForm.toasts.presetApplied'),
        description: t('batteryForm.toasts.presetUpdated', { label: preset.label })
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResults([]);

    const payload = {
      min_energy: Number(formData.minEnergy) || 0,
      min_continuous_power: Number(formData.minPower) || 0,
      min_voltage: Number(formData.minVoltage) || 0,
      max_voltage: Number(formData.maxVoltage) || 0,
      max_width: Number(formData.maxWidth) * 1000 || 10000,
      max_length: Number(formData.maxLength) * 1000 || 10000,
      max_height: Number(formData.maxHeight) * 1000 || 10000,
      max_weight: Number(formData.maxWeight) || 1000,
      max_price: Number(formData.maxPrice) || 10000,
      ambient_temp: 25
    };

    try {
      const response = await fetch('/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();
      const configs = data.results || [];

      if (configs.length === 0) {
        toast({
          title: t('batteryForm.toasts.noSolutions'),
          description: t('batteryForm.toasts.relaxConstraints'),
          variant: "destructive"
        });
      } else {
        setResults(configs);
        toast({
          title: t('batteryForm.toasts.success'),
          description: t('batteryForm.toasts.designsFound', { count: configs.length })
        });

        setTimeout(() => {
          document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }

    } catch (error) {
      console.error("Erro:", error);
      toast({
        title: t('batteryForm.toasts.connectionError'),
        description: t('batteryForm.toasts.backendError'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SeoHead />
      <Analytics />
      <div className="container px-4 py-12 mx-auto max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('batteryForm.backToHome')}
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">{t('batteryForm.title')}</h1>
          <p className="text-lg text-muted-foreground">
            {t('batteryForm.subtitle')}
          </p>
        </div>

        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
          <Label className="text-lg font-semibold mb-2 block">{t('batteryForm.step1Title')}</Label>
          <Select onValueChange={handlePresetChange} value={useCase}>
            <SelectTrigger className="w-full md:w-1/2 bg-white">
              <SelectValue placeholder={t('batteryForm.selectProject')} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(USE_CASES).map(([key, data]) => (
                <SelectItem key={key} value={key}>{data.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid md:grid-cols-2 gap-6">

            <div className="space-y-4 p-4 border rounded-lg bg-card">
              <h3 className="font-semibold text-primary flex items-center">
                {t('batteryForm.voltagePower')}
                {/* Imagem do diagrama de ligação em série vs paralelo */}
              </h3>

              <div className="space-y-2">
                <Label>{t('batteryForm.minVoltage')} <InfoTooltip content={t('batteryForm.minVoltageTooltip')} /></Label>
                <Input name="minVoltage" type="number" step="0.1" value={formData.minVoltage} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label>{t('batteryForm.maxVoltage')} <InfoTooltip content={t('batteryForm.maxVoltageTooltip')} /></Label>
                <Input name="maxVoltage" type="number" step="0.1" value={formData.maxVoltage} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label>{t('batteryForm.continuousPower')} <InfoTooltip content={t('batteryForm.continuousPowerTooltip')} /></Label>
                <Input name="minPower" type="number" step="1" value={formData.minPower} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label>{t('batteryForm.minEnergy')} <InfoTooltip content={t('batteryForm.minEnergyTooltip')} /></Label>
                <Input name="minEnergy" type="number" value={formData.minEnergy} onChange={handleChange} required />
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-card">
              <h3 className="font-semibold text-primary">{t('batteryForm.physicalLimits')}</h3>

              <div className="space-y-2">
                <Label>{t('batteryForm.maxLength')}</Label>
                <Input name="maxLength" type="number" step="0.01" value={formData.maxLength} onChange={handleChange} placeholder={t('batteryForm.optional')} />
              </div>
              <div className="space-y-2">
                <Label>{t('batteryForm.maxWidth')}</Label>
                <Input name="maxWidth" type="number" step="0.01" value={formData.maxWidth} onChange={handleChange} placeholder={t('batteryForm.optional')} />
              </div>
              <div className="space-y-2">
                <Label>{t('batteryForm.maxHeight')} <InfoTooltip content={t('batteryForm.maxHeightTooltip')} /></Label>
                <Input name="maxHeight" type="number" step="0.01" value={formData.maxHeight} onChange={handleChange} placeholder={t('batteryForm.optional')} />
              </div>
              <div className="space-y-2">
                <Label>{t('batteryForm.maxPrice')}</Label>
                <Input name="maxPrice" type="number" value={formData.maxPrice} onChange={handleChange} placeholder={t('batteryForm.optional')} />
              </div>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('batteryForm.calculating')}</> : t('batteryForm.findBattery')}
          </Button>
        </form>

        {results.length > 0 && (
          <div id="results-section" className="mt-16 space-y-6 animate-in fade-in slide-in-from-bottom-10">
            <h2 className="text-3xl font-bold">{t('batteryForm.recommendedBuilds')}</h2>
            <p className="text-muted-foreground">{t('batteryForm.rankedBy')}</p>

            <div className="grid gap-6">
              {results.map((res, index) => (
                <Card key={index} className={`border-l-4 ${res.safety.safety_score < 50 ? 'border-l-red-500' : 'border-l-emerald-500'} shadow-md hover:shadow-lg transition-shadow`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          {res.series_cells}S{res.parallel_cells}P {t('batteryForm.with')} {res.cell.Brand}
                          {index === 0 && <Badge className="bg-emerald-600">{t('batteryForm.bestValue')}</Badge>}
                        </CardTitle>
                        <CardDescription>{res.cell.CellModelNo} • {res.battery_energy} Wh • {res.battery_voltage}V {t('batteryForm.nominal')}</CardDescription>
                      </div>

                      <div className="text-right">
                        <div className={`text-2xl font-bold ${res.safety.safety_score >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {res.safety.safety_score}/100
                        </div>
                        <div className="text-xs text-muted-foreground">{t('batteryForm.safetyScore')}</div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>{t('batteryForm.configuration')}:</span> <span className="font-mono">{res.series_cells} {t('batteryForm.series')} / {res.parallel_cells} {t('batteryForm.parallel')}</span></div>
                        <div className="flex justify-between"><span>{t('batteryForm.maxPower')}:</span> <span className="font-mono">{res.continuous_power} W</span></div>
                        <div className="flex justify-between"><span>{t('batteryForm.totalWeight')}:</span> <span className="font-mono">{res.battery_weight} kg</span></div>
                        <div className="flex justify-between font-bold mt-2 pt-2 border-t"><span>{t('batteryForm.estPrice')}:</span> <span>€{res.total_price}</span></div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded text-sm space-y-1">
                        <p className="font-semibold text-xs uppercase text-slate-500 mb-1">{t('batteryForm.requiredComponents')}</p>
                        <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-600" /> BMS: {res.bms.brand} ({res.bms.model})</div>
                        <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-600" /> Fuse: {res.fuse.model}</div>
                        <div className="text-xs text-blue-600 mt-2 hover:underline cursor-pointer">{t('batteryForm.viewWiringDiagram')}</div>
                      </div>
                    </div>

                    {res.safety.warnings.length > 0 && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
                        <div className="flex items-center gap-2 font-bold mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          {t('batteryForm.safetyAdvisory')}
                        </div>
                        <ul className="list-disc pl-5 space-y-1">
                          {res.safety.warnings.map((warn, i) => (
                            <li key={i}>{warn}</li>
                          ))}
                        </ul>
                        {res.safety.recommendations.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-amber-200">
                            <span className="font-semibold text-xs uppercase text-amber-700">{t('batteryForm.howToFix')}</span>
                            <ul className="list-disc pl-5 mt-1 text-amber-800">
                              {res.safety.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {res.safety.safety_score === 0 && (
                      <div className="mt-2 p-2 bg-red-100 text-red-700 text-xs font-bold text-center rounded border border-red-300 flex items-center justify-center gap-2">
                        <Flame className="w-4 h-4" /> {t('batteryForm.fireRisk')}
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