/**
 * TemplateSelector Component
 * Displays all blog templates in a grid for selection
 */

import { Check, FileText, Plus, Pencil, Eye } from 'lucide-react';
import type { BloggerTemplate } from '@/types/blogger';
import { isUserCreated } from '@/types/blogger';

interface TemplateSelectorProps {
  templates: BloggerTemplate[];
  selectedTemplateId: string | null;
  onSelect: (template: BloggerTemplate) => void;
  onCreateClick?: () => void;
  onEditClick?: (template: BloggerTemplate) => void;
  onPreviewClick?: (template: BloggerTemplate) => void;
  isLoading?: boolean;
}

export function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelect,
  onCreateClick,
  onEditClick,
  onPreviewClick,
  isLoading = false,
}: TemplateSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Select a Template</h3>
        {onCreateClick && (
          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const isSelected = selectedTemplateId === template.id;
          const canEdit = isUserCreated(template);

          return (
            <div
              key={template.id}
              className={`
                relative p-4 rounded-lg border-2 transition-all
                ${isSelected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                }
                ${isLoading ? 'opacity-50' : ''}
              `}
            >
              {/* Selection checkbox */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              {/* System badge for non-editable templates */}
              {!canEdit && (
                <span className="absolute top-3 left-3 px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                  System
                </span>
              )}

              {/* Card content - clickable for selection */}
              <button
                type="button"
                onClick={() => onSelect(template)}
                disabled={isLoading}
                className={`w-full text-left ${canEdit ? 'pr-8' : 'pr-8 pt-6'} ${isLoading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
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
              </button>

              {/* Edit button - only for user-created templates */}
              {canEdit && onEditClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditClick(template);
                  }}
                  className="absolute bottom-3 right-3 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Edit template"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}

              {/* Preview button - for system templates */}
              {!canEdit && onPreviewClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewClick(template);
                  }}
                  className="absolute bottom-3 right-3 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="View template details"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>
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
