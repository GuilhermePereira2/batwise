import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LocationCombobox } from '@/components/LocationCombobox';
import { FriendlyNumericInput } from './FriendlyNumericInput';

interface StepHouseDataProps {
  formData: any;
  setFormData: (data: any) => void;
}

export const StepHouseData: React.FC<StepHouseDataProps> = ({ formData, setFormData }) => {
  const handlePostcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const country = formData.solar.country;
    let formatted = val;

    if (country === 'Portugal') {
      const digits = val.replace(/\D/g, '').slice(0, 7);
      if (digits.length > 4) {
        formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
      } else {
        formatted = digits;
      }
    } else if (country === 'Espanha') {
      formatted = val.replace(/\D/g, '').slice(0, 5);
    }

    setFormData({ ...formData, solar: { ...formData.solar, city: formatted } });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Localização e Habitação</h2>
        <p className="text-gray-500">Estes dados ajudam-nos a estimar a incidência solar e o perfil térmico da sua casa.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-3">
          <Label className="text-gray-900 font-bold">País</Label>
          <LocationCombobox
            type="country"
            value={formData.solar.country}
            onChange={(val) => setFormData({ ...formData, solar: { ...formData.solar, country: val } })}
            placeholder="Selecione o país"
          />
          <p className="text-xs text-gray-400">Determina a base de custos e clima.</p>
        </div>
        <div className="space-y-3">
          <Label className="text-gray-900 font-bold">Código Postal</Label>
          <Input
            value={formData.solar.city}
            onChange={handlePostcodeChange}
            placeholder={formData.solar.country === 'Portugal' ? "1000-001" : "28001"}
            className="h-12 bg-white border-gray-200 text-gray-900 rounded-xl focus-visible:ring-orange-600"
          />
        </div>
        <div className="space-y-3">
          <Label className="text-gray-900 font-bold">Localidade</Label>
          <Input
            value={formData.solar.location}
            onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, location: e.target.value } })}
            placeholder="Ex: Lisboa"
            className="h-12 bg-white border-gray-200 text-gray-900 rounded-xl focus-visible:ring-orange-600"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pt-6 border-t border-gray-100">
        <FriendlyNumericInput
          label="Nº de Pessoas"
          value={formData.house.occupants}
          onChange={(val) => setFormData({ ...formData, house: { ...formData.house, occupants: val } })}
          min={1}
          max={12}
          unit="pessoas"
        />
        <FriendlyNumericInput
          label="Área da Casa"
          value={formData.house.area_m2}
          onChange={(val) => setFormData({ ...formData, house: { ...formData.house, area_m2: val } })}
          min={20}
          max={1000}
          step={10}
          unit="m²"
          useSlider
        />
        <FriendlyNumericInput
          label="Nº de Pisos"
          value={formData.house.floors}
          onChange={(val) => setFormData({ ...formData, house: { ...formData.house, floors: val } })}
          min={1}
          max={5}
          unit="pisos"
        />
      </div>
    </div>
  );
};
