/**
 * BlogWizard Component
 * Multi-step form container for blog creation
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  'Persona Selection',
  'Template Selection',
  'Keyword Research',
  'Meta Data',
  'Content Preview',
  'SEO Optimization',
  'Images & Links',
  'Final Preview',
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
    <div className="flex flex-col h-full">
      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Step {currentStep} of {totalSteps}: {STEP_TITLES[currentStep - 1]}
          </h2>
          <span className="text-sm text-gray-600">{Math.round(progress)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-8">
        <div className="max-w-4xl mx-auto">{children}</div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button
            onClick={onPrevious}
            disabled={currentStep === 1 || isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700
              bg-white border border-gray-300 rounded-md hover:bg-gray-50
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <button
            onClick={onNext}
            disabled={!canGoNext || isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
              bg-blue-600 border border-transparent rounded-md hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              'Processing...'
            ) : currentStep === totalSteps ? (
              'Finish'
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
