import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

const BatteryForm = () => {
  const navigate = useNavigate();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid()) {
      console.log("Form submitted:", formData);
      // Handle form submission here
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
              <Label htmlFor="minEnergy">Minimum energy (kWh)</Label>
              <Input
                id="minEnergy"
                name="minEnergy"
                type="number"
                step="0.01"
                value={formData.minEnergy}
                onChange={handleChange}
                required
                placeholder="Enter minimum energy"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minVoltage">Minimum nominal voltage (V)</Label>
              <Input
                id="minVoltage"
                name="minVoltage"
                type="number"
                step="0.01"
                value={formData.minVoltage}
                onChange={handleChange}
                required
                placeholder="Enter minimum voltage"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxVoltage">Maximum nominal voltage (V)</Label>
              <Input
                id="maxVoltage"
                name="maxVoltage"
                type="number"
                step="0.01"
                value={formData.maxVoltage}
                onChange={handleChange}
                required
                placeholder="Enter maximum voltage"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minPower">Minimum rated power (W)</Label>
              <Input
                id="minPower"
                name="minPower"
                type="number"
                step="0.01"
                value={formData.minPower}
                onChange={handleChange}
                required
                placeholder="Enter minimum power"
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
                placeholder="Enter maximum length"
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
                placeholder="Enter maximum width"
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
                placeholder="Enter maximum height"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="maxPrice">Maximum price (€)</Label>
              <Input
                id="maxPrice"
                name="maxPrice"
                type="number"
                step="0.01"
                value={formData.maxPrice}
                onChange={handleChange}
                required
                placeholder="Enter maximum price"
              />
            </div>
          </div>

          <div className="pt-6">
            <Button
              type="submit"
              size="lg"
              className="w-full md:w-auto"
              disabled={!isFormValid()}
            >
              Submit Requirements
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BatteryForm;
