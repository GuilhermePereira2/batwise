import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  title: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
  onStepClick?: (step: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, className, onStepClick }) => {
  return (
    <div className={cn("w-full py-4", className)}>
      <div className="flex items-start justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200 -z-10" />
        <div 
          className="absolute top-5 left-0 h-0.5 bg-orange-600 transition-all duration-500 -z-10" 
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = currentStep > stepNumber;
          const isActive = currentStep === stepNumber;
          const isClickable = onStepClick && stepNumber < currentStep;

          return (
            <div 
              key={index} 
              className={cn(
                "flex flex-col items-center flex-1",
                isClickable ? "cursor-pointer group" : "cursor-default"
              )}
              onClick={() => isClickable && onStepClick?.(stepNumber)}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-white",
                  isCompleted ? "border-orange-600 bg-orange-600 text-white" : 
                  isActive ? "border-orange-600 text-orange-600 ring-4 ring-orange-100" : 
                  "border-gray-300 text-gray-400",
                  isClickable && "group-hover:border-orange-400"
                )}
              >
                {isCompleted ? (
                  <Check className="w-6 h-6" />
                ) : (
                  <span className="font-semibold">{stepNumber}</span>
                )}
              </div>
              <div className="mt-2 text-center">
                <p className={cn(
                  "text-xs font-bold uppercase tracking-wider transition-colors",
                  isActive || isCompleted ? "text-gray-900" : "text-gray-400",
                  isClickable && "group-hover:text-orange-600"
                )}>
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-[10px] text-gray-500 font-medium hidden md:block">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
