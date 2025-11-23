/**
 * TemplateSelector Component
 * Displays all blog templates in a grid for selection
 */

import { Check, FileText } from 'lucide-react';
import type { BloggerTemplate } from '@/types/blogger';

interface TemplateSelectorProps {
  templates: BloggerTemplate[];
  selectedTemplateId: string | null;
  onSelect: (template: BloggerTemplate) => void;
  isLoading?: boolean;
}

export function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelect,
  isLoading = false,
}: TemplateSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const isSelected = selectedTemplateId === template.id;

          return (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              disabled={isLoading}
              className={`
                relative p-4 text-left rounded-lg border-2 transition-all
                ${isSelected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              <div className="pr-8">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">{template.name}</h4>
                </div>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {template.description}
                </p>
                {template.content_structure && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-700">Structure:</p>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {template.content_structure}
                    </p>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {templates.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          No templates available. Please contact support.
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-gray-500">
          Loading templates...
        </div>
      )}
    </div>
  );
}
