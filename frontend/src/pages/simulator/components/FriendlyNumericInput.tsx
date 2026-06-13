import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface FriendlyNumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unit?: string;
  className?: string;
  useSlider?: boolean;
}

export const FriendlyNumericInput: React.FC<FriendlyNumericInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit,
  className,
  useSlider = false,
}) => {
  const handleDecrement = () => {
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, value + step));
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-between items-center">
        {label && <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">{label}</label>}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-20 h-10 text-center font-bold border-gray-300 focus:ring-orange-600"
            min={min}
            max={max}
          />
          {unit && <span className="text-sm text-gray-500 font-medium">{unit}</span>}
        </div>
      </div>

      {useSlider ? (
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(val) => onChange(val[0])}
          className="py-4"
        />
      ) : (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handleDecrement}
            className="h-12 w-12 rounded-xl border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all active:scale-90"
          >
            <Minus className="w-5 h-5" />
          </Button>
          <div className="flex-1 h-2 bg-gray-100 rounded-full relative overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-orange-600 transition-all duration-300"
              style={{ width: `${((value - min) / (max - min)) * 100}%` }}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleIncrement}
            className="h-12 w-12 rounded-xl border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all active:scale-90"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
};
