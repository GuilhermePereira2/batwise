import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  YAxisProps
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DebugSimulationChartProps {
  data: {
    load: number[];
    pv: number[];
    soc: number[];
  };
}

const DebugSimulationChart: React.FC<DebugSimulationChartProps> = ({ data }) => {
  const chartData = useMemo(() => {
    if (!data || !data.load) return [];
    
    // We map the data to a format Recharts understands
    // To avoid lag with 8760 points, we could potentially downsample, 
    // but the user asked for zoom, so we provide all points and use Brush.
    return data.load.map((l, i) => ({
      hour: i,
      day: Math.floor(i / 24) + 1,
      Consumo: Number(l.toFixed(3)),
      Solar: Number((data.pv[i] || 0).toFixed(3)),
      Bateria: Number((data.soc[i] || 0).toFixed(3)),
    }));
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <Card className="w-full border-orange-200 bg-orange-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <span className="p-1.5 bg-orange-100 rounded-lg text-orange-600">🛠️</span>
          Debug: Simulação Horária (8760h)
        </CardTitle>
        <p className="text-xs text-gray-500">
          Usa a barra inferior para fazer zoom e navegar no tempo. Valores em kWh.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full bg-white rounded-xl p-4 border border-orange-100 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="hour" 
                hide 
              />
              <YAxis 
                yAxisId="energy"
                label={{ value: 'kWh', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                labelFormatter={(value) => `Hora: ${value} (Dia ${Math.floor(Number(value) / 24) + 1})`}
              />
              <Legend verticalAlign="top" height={36}/>
              <Line
                yAxisId="energy"
                type="monotone"
                dataKey="Consumo"
                stroke="#ef4444"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="energy"
                type="monotone"
                dataKey="Solar"
                stroke="#eab308"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="energy"
                type="monotone"
                dataKey="Bateria"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Brush 
                dataKey="hour" 
                height={30} 
                stroke="#ea580c" 
                startIndex={0} 
                endIndex={168} // Show first week by default
                tickFormatter={(value) => `Dia ${Math.floor(Number(value) / 24) + 1}`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default DebugSimulationChart;
