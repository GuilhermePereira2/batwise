import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react"; // Adicionei Loader2
import { useToast } from "@/hooks/use-toast"; // Assumindo que tens o hook do shadcn/ui

const BatteryForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const isFormValid = () => {
    return Object.values(formData).every((value) => value.trim() !== "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid()) return;

    setIsLoading(true);

    // 1. Preparar os dados para o Backend Python
    // NOTA: O Python espera mm, mas o form pede metros. Multiplicamos por 1000.
    const payload = {
      min_energy: Number(formData.minEnergy),
      min_continuous_power: Number(formData.minPower),
      min_voltage: Number(formData.minVoltage),
      max_voltage: Number(formData.maxVoltage),
      max_width: Number(formData.maxWidth),   // Converter m -> mm
      max_length: Number(formData.maxLength), // Converter m -> mm
      max_height: Number(formData.maxHeight), // Converter m -> mm
      max_weight: Number(formData.maxWeight),
      max_price: Number(formData.maxPrice),
      ambient_temp: 25 // Valor default
    };

    try {
      console.log("Enviando para o backend:", payload);

      // 2. Chamar a API Python (Certifica-te que o main.py está a correr na porta 8000)
      const response = await fetch('http://localhost:8000/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro do servidor: ${errorText}`);
      }

      const results = await response.json();

      if (results.length === 0) {
        toast({
          title: "Sem soluções",
          description: "Não foi possível encontrar baterias compatíveis com estes limites.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso!",
          description: `${results.length} configurações geradas.`,
        });

        console.log("Resultados recebidos:", results);

        // AQUI: Deves navegar para a página de resultados e passar os dados
        // Exemplo: navigate("/results", { state: { configurations: results } });
        // Por enquanto, apenas logamos.
      }

    } catch (error) {
      console.error("Erro no fetch:", error);
      toast({
        title: "Erro de Conexão",
        description: "Verifica se o backend Python está a correr (uvicorn main:app).",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container px-4 py-12 mx-auto max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Battery Requirements
          </h1>
          <p className="text-lg text-muted-foreground">
            Fill in your battery specifications to get started with the optimization process.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="maxWeight">Maximum weight (kg)</Label>
              <Input
                id="maxWeight"
                name="maxWeight"
                type="number"
                step="0.01"
                value={formData.maxWeight}
                onChange={handleChange}
                required
                placeholder="Enter maximum weight"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minEnergy">Minimum energy (Wh)</Label>
              {/* NOTA: Mudei placeholder para Wh para bater certo com backend */}
              <Input
                id="minEnergy"
                name="minEnergy"
                type="number"
                step="1"
                value={formData.minEnergy}
                onChange={handleChange}
                required
                placeholder="Ex: 5000 Wh"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minVoltage">Minimum nominal voltage (V)</Label>
              <Input
                id="minVoltage"
                name="minVoltage"
                type="number"
                step="0.1"
                value={formData.minVoltage}
                onChange={handleChange}
                required
                placeholder="Ex: 40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxVoltage">Maximum nominal voltage (V)</Label>
              <Input
                id="maxVoltage"
                name="maxVoltage"
                type="number"
                step="0.1"
                value={formData.maxVoltage}
                onChange={handleChange}
                required
                placeholder="Ex: 58.8"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minPower">Minimum rated power (W)</Label>
              <Input
                id="minPower"
                name="minPower"
                type="number"
                step="1"
                value={formData.minPower}
                onChange={handleChange}
                required
                placeholder="Ex: 2000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxLength">Maximum length (m)</Label>
              <Input
                id="maxLength"
                name="maxLength"
                type="number"
                step="0.01"
                value={formData.maxLength}
                onChange={handleChange}
                required
                placeholder="Ex: 0.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxWidth">Maximum width (m)</Label>
              <Input
                id="maxWidth"
                name="maxWidth"
                type="number"
                step="0.01"
                value={formData.maxWidth}
                onChange={handleChange}
                required
                placeholder="Ex: 0.3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxHeight">Maximum height (m)</Label>
              <Input
                id="maxHeight"
                name="maxHeight"
                type="number"
                step="0.01"
                value={formData.maxHeight}
                onChange={handleChange}
                required
                placeholder="Ex: 0.2"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="maxPrice">Maximum price (€)</Label>
              <Input
                id="maxPrice"
                name="maxPrice"
                type="number"
                step="1"
                value={formData.maxPrice}
                onChange={handleChange}
                required
                placeholder="Ex: 1500"
              />
            </div>
          </div>

          <div className="pt-6">
            <Button
              type="submit"
              size="lg"
              className="w-full md:w-auto"
              disabled={!isFormValid() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Optimizing Designs...
                </>
              ) : (
                "Generate Configurations"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BatteryForm;