import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Home as HomeIcon, FileText } from "lucide-react";

interface StepModeSelectionProps {
  onSelect: (mode: 'house' | 'bill' | 'eredes') => void;
  selectedMode?: string;
}

export const StepModeSelection: React.FC<StepModeSelectionProps> = ({ onSelect, selectedMode }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card
        onClick={() => onSelect('house')}
        className={`cursor-pointer border-2 transition-all hover:shadow-xl group active:scale-95 ${selectedMode === 'house' ? 'border-orange-600 bg-orange-50/50' : 'border-gray-200 hover:border-orange-200'}`}
      >
        <CardContent className="p-8 text-center">
          <div className="bg-orange-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:rotate-3 transition-transform">
            <HomeIcon className="text-white w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-3">Simulação Rápida</h3>
          <p className="text-gray-500 text-sm leading-relaxed">Quero estimar pelo número de pessoas e características da casa, com fatura opcional.</p>
        </CardContent>
      </Card>

      <Card
        onClick={() => onSelect('bill')}
        className={`cursor-pointer border-2 transition-all hover:shadow-xl group active:scale-95 ${selectedMode === 'bill' ? 'border-orange-600 bg-orange-50/50' : 'border-gray-200 hover:border-orange-200'}`}
      >
        <CardContent className="p-8 text-center">
          <div className="bg-orange-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:rotate-3 transition-transform">
            <FileText className="text-white w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-3">Dados de Faturas</h3>
          <p className="text-gray-500 text-sm leading-relaxed">Inserir manualmente os dados de consumo de um ou mais meses das minhas faturas.</p>
        </CardContent>
      </Card>

      <Card
        onClick={() => onSelect('eredes')}
        className={`cursor-pointer border-2 transition-all hover:shadow-xl group active:scale-95 ${selectedMode === 'eredes' ? 'border-orange-600 bg-orange-50/50' : 'border-gray-200 hover:border-orange-200'}`}
      >
        <CardContent className="p-8 text-center">
          <div className="bg-orange-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:rotate-3 transition-transform">
            <Zap className="text-white w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-3">Ficheiro E-Redes</h3>
          <p className="text-gray-500 text-sm leading-relaxed">Upload do ficheiro de consumos da E-Redes (.csv ou .xlsx) para simulação real.</p>
        </CardContent>
      </Card>
    </div>
  );
};
