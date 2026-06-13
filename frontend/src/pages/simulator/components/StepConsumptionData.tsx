import React from 'react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Car } from "lucide-react";
import { FriendlyNumericInput } from './FriendlyNumericInput';

interface StepConsumptionDataProps {
  formData: any;
  setFormData: (data: any) => void;
  updateElectricVehicle: (index: number, field: string, value: string | number) => void;
  addElectricVehicle: () => void;
  removeElectricVehicle: (index: number) => void;
}

export const StepConsumptionData: React.FC<StepConsumptionDataProps> = ({ 
  formData, 
  setFormData,
  updateElectricVehicle,
  addElectricVehicle,
  removeElectricVehicle
}) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Perfil de Consumo e Mobilidade</h2>
        <p className="text-gray-500">Adicione veículos elétricos e outros consumos significativos para uma simulação real.</p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Car className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <Label className="text-lg font-bold text-gray-900">Tem veículos elétricos?</Label>
              <p className="text-sm text-gray-500">O carregamento de carros representa ~40% do consumo de uma casa moderna.</p>
            </div>
          </div>
          <Button
            onClick={addElectricVehicle}
            className="bg-orange-600 hover:bg-orange-700 text-white h-[48px] px-6 rounded-xl shadow-lg shadow-orange-100"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Veículo
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {formData.electric_vehicles.vehicles.map((vehicle: any, index: number) => (
            <Card key={index} className="border-gray-200 overflow-hidden group animate-in zoom-in-95 duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    Veículo {index + 1}
                  </h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeElectricVehicle(index)}
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  <FriendlyNumericInput
                    label="Km Diários"
                    value={vehicle.daily_km}
                    onChange={(val) => updateElectricVehicle(index, 'daily_km', val)}
                    min={1}
                    max={500}
                    unit="km"
                  />
                  
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Horário de Carregamento</Label>
                    <div className="grid grid-cols-3 gap-2 h-[48px]">
                      <Button
                        variant={vehicle.charging_schedule === 'night' ? "default" : "outline"}
                        className={vehicle.charging_schedule === 'night' ? "bg-indigo-600 hover:bg-indigo-700" : "border-gray-200"}
                        onClick={() => updateElectricVehicle(index, 'charging_schedule', 'night')}
                      >
                        Noite
                      </Button>
                      <Button
                        variant={vehicle.charging_schedule === 'day' ? "default" : "outline"}
                        className={vehicle.charging_schedule === 'day' ? "bg-orange-500 hover:bg-orange-600" : "border-gray-200"}
                        onClick={() => updateElectricVehicle(index, 'charging_schedule', 'day')}
                      >
                        Dia
                      </Button>
                      <Button
                        variant={vehicle.charging_schedule === 'varying' ? "default" : "outline"}
                        className={vehicle.charging_schedule === 'varying' ? "bg-emerald-600 hover:bg-emerald-700" : "border-gray-200"}
                        onClick={() => updateElectricVehicle(index, 'charging_schedule', 'varying')}
                      >
                        Variável
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
