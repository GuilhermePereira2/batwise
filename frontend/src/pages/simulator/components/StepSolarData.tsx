import React from 'react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FriendlyNumericInput } from './FriendlyNumericInput';

interface StepSolarDataProps {
  formData: any;
  setFormData: (data: any) => void;
  renderRoofMapPicker: () => React.ReactNode;
  mode?: string;
}

export const StepSolarData: React.FC<StepSolarDataProps> = ({ formData, setFormData, renderRoofMapPicker, mode }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Energia Solar e Telhado</h2>
        <p className="text-gray-500">Configure o seu sistema atual ou use o mapa para desenhar o seu telhado.</p>
      </div>

      <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Label className="text-lg font-bold text-gray-900">Já tem painéis solares instalados?</Label>
            <p className="text-sm text-gray-500">Se sim, otimizamos o sistema considerando a sua produção.</p>
          </div>
          <div className="flex gap-2 h-[48px] md:w-48">
            <Button
              variant={formData.solar.has_solar ? "outline" : "default"}
              className={formData.solar.has_solar ? "flex-1 border-gray-200" : "flex-1 bg-orange-600 hover:bg-orange-700"}
              onClick={() => setFormData({ 
                ...formData, 
                solar: { ...formData.solar, has_solar: false },
                eredes: { ...formData.eredes, has_solar_before: false }
              })}
            >
              Não
            </Button>
            <Button
              variant={formData.solar.has_solar ? "default" : "outline"}
              className={formData.solar.has_solar ? "flex-1 bg-orange-600 hover:bg-orange-700" : "flex-1 border-gray-200"}
              onClick={() => setFormData({ 
                ...formData, 
                solar: { ...formData.solar, has_solar: true },
                eredes: { ...formData.eredes, has_solar_before: true }
              })}
            >
              Sim
            </Button>
          </div>
        </div>

        {formData.solar.has_solar && (
          <div className="space-y-6 pt-4 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FriendlyNumericInput
                label="Potência de Pico Instalada"
                value={formData.solar.peak_kw}
                onChange={(val) => setFormData({ ...formData, solar: { ...formData.solar, peak_kw: val } })}
                min={0.1}
                max={50}
                step={0.1}
                unit="kWp"
                useSlider
              />
              <FriendlyNumericInput
                label="Potência Máx. Inversor"
                value={formData.solar.existing_inverter_max_power_kw}
                onChange={(val) => setFormData({ ...formData, solar: { ...formData.solar, existing_inverter_max_power_kw: val } })}
                min={0.1}
                max={50}
                step={0.1}
                unit="kW"
              />
            </div>

            <div className="border-t border-orange-200 pt-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <Label className="font-bold text-gray-900">Pretende instalar mais painéis solares?</Label>
                  <p className="text-sm text-gray-500">Iremos sugerir a expansão do seu sistema fotovoltaico atual.</p>
                </div>
                <div className="flex gap-2 h-[40px] md:w-32">
                  <Button
                    variant={formData.solar.expand_solar ? "default" : "outline"}
                    size="sm"
                    className={formData.solar.expand_solar ? "flex-1 bg-orange-600 hover:bg-orange-700" : "flex-1 border-gray-200"}
                    onClick={() => setFormData({ ...formData, solar: { ...formData.solar, expand_solar: true } })}
                  >
                    Sim
                  </Button>
                  <Button
                    variant={formData.solar.expand_solar ? "outline" : "default"}
                    size="sm"
                    className={formData.solar.expand_solar ? "flex-1 border-gray-200" : "flex-1 bg-orange-600 hover:bg-orange-700"}
                    onClick={() => setFormData({ ...formData, solar: { ...formData.solar, expand_solar: false } })}
                  >
                    Não
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Marca do Inversor Atual</Label>
                  <Input 
                    placeholder="Ex: Huawei, Fronius, SMA..." 
                    value={formData.solar.existing_inverter_brand}
                    onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, existing_inverter_brand: e.target.value } })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modelo do Inversor Atual</Label>
                  <Input 
                    placeholder="Ex: SUN2000-5KTL..." 
                    value={formData.solar.existing_inverter_model}
                    onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, existing_inverter_model: e.target.value } })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Label className="text-lg font-bold text-gray-900">Já tem bateria instalada?</Label>
            <p className="text-sm text-gray-500">Se sim, consideramos a sua capacidade atual na simulação.</p>
          </div>
          <div className="flex gap-2 h-[48px] md:w-48">
            <Button
              variant={formData.solar.has_battery ? "outline" : "default"}
              className={formData.solar.has_battery ? "flex-1 border-gray-200" : "flex-1 bg-orange-600 hover:bg-orange-700"}
              onClick={() => setFormData({ ...formData, solar: { ...formData.solar, has_battery: false } })}
            >
              Não
            </Button>
            <Button
              variant={formData.solar.has_battery ? "default" : "outline"}
              className={formData.solar.has_battery ? "flex-1 bg-orange-600 hover:bg-orange-700" : "flex-1 border-gray-200"}
              onClick={() => setFormData({ ...formData, solar: { ...formData.solar, has_battery: true } })}
            >
              Sim
            </Button>
          </div>
        </div>

        {formData.solar.has_battery && (
          <div className="space-y-6 pt-4 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca da Bateria</Label>
                <Input 
                  placeholder="Ex: BYD, Pylontech, LG..." 
                  value={formData.solar.existing_battery_brand}
                  onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, existing_battery_brand: e.target.value } })}
                />
              </div>
              <div className="space-y-2">
                <Label>Modelo da Bateria</Label>
                <Input 
                  placeholder="Ex: HVS 5.1, US3000C..." 
                  value={formData.solar.existing_battery_model}
                  onChange={(e) => setFormData({ ...formData, solar: { ...formData.solar, existing_battery_model: e.target.value } })}
                />
              </div>
            </div>
            <FriendlyNumericInput
              label="Capacidade da Bateria Atual"
              value={formData.solar.battery_capacity_kwh}
              onChange={(val) => setFormData({ ...formData, solar: { ...formData.solar, battery_capacity_kwh: val } })}
              min={0.1}
              max={100}
              step={0.1}
              unit="kWh"
              useSlider
            />
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Label className="text-lg font-bold text-gray-900">Pretende desenhar o seu telhado no mapa?</Label>
            <p className="text-sm text-gray-500">Permite-nos calcular a área exata disponível para painéis.</p>
          </div>
          <div className="flex gap-2 h-[48px] md:w-48">
            <Button
              variant={formData.solar.roof_mapping?.enabled ? "outline" : "default"}
              className={formData.solar.roof_mapping?.enabled ? "flex-1 border-gray-200" : "flex-1 bg-orange-600 hover:bg-orange-700"}
              onClick={() => setFormData({ ...formData, solar: { ...formData.solar, roof_mapping: { ...formData.solar.roof_mapping, enabled: false } } })}
            >
              Não
            </Button>
            <Button
              variant={formData.solar.roof_mapping?.enabled ? "default" : "outline"}
              className={formData.solar.roof_mapping?.enabled ? "flex-1 bg-orange-600 hover:bg-orange-700" : "flex-1 border-gray-200"}
              onClick={() => setFormData({ ...formData, solar: { ...formData.solar, roof_mapping: { ...formData.solar.roof_mapping, enabled: true } } })}
            >
              Sim
            </Button>
          </div>
        </div>

        {formData.solar.roof_mapping?.enabled && (
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-inner bg-gray-50 animate-in zoom-in-95 duration-500">
            {renderRoofMapPicker()}
          </div>
        )}
      </div>
    </div>
  );
};
