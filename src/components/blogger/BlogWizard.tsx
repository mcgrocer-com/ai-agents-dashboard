/**
 * BlogWizard Component
 * Multi-step form container for blog creation
 */

import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  FileText,
  User,
  Settings,
  Eye,
  Send,
  Loader2
} from 'lucide-react';
import type { WizardStep } from '@/types/blogger';

interface BlogWizardProps {
  currentStep: WizardStep;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  canGoNext: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
}

const STEP_TITLES = [
  'Topic Input',
  'Choose Persona',
  'Select Template',
  'Content Preview',
  'Meta Data',
  'Final Preview',
];

const STEP_ICONS = [
  FileText,
  User,
  FileText,
  Eye,
  Settings,
  Send
];

export function BlogWizard({
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  canGoNext,
  isLoading = false,
  children,
}: BlogWizardProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Step {currentStep} of {totalSteps}: {STEP_TITLES[currentStep - 1]}
            </h2>
            <span className="text-sm text-gray-600">{Math.round(progress)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between mb-8 overflow-x-auto pb-2">
          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNumber = i + 1;
            const StepIcon = STEP_ICONS[i];
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;

            return (
              <div key={stepNumber} className="flex flex-col items-center min-w-0 flex-1 px-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors duration-200 ${isActive
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                >
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                </div>
                <span
                  className={`text-xs text-center hidden sm:block ${isActive ? 'text-blue-600 font-medium' : 'text-gray-600'
                    }`}
                >
                  {STEP_TITLES[i]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mb-8">
          <button
            onClick={onPrevious}
            disabled={currentStep === 1 || isLoading}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={onNext}
            disabled={!canGoNext || isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : currentStep === totalSteps ? (
              <span>Finish</span>
            ) : (
              <>
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800">
              {STEP_TITLES[currentStep - 1]}
            </h3>
          </div>
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
