/**
 * PersonaSelector Component
 * Displays all personas in a grid for selection
 */

import { Check, Plus, Pencil, Eye } from 'lucide-react';
import type { BloggerPersona } from '@/types/blogger';
import { isUserCreated } from '@/types/blogger';

interface PersonaSelectorProps {
  personas: BloggerPersona[];
  selectedPersonaId: string | null;
  onSelect: (persona: BloggerPersona) => void;
  onCreateClick?: () => void;
  onEditClick?: (persona: BloggerPersona) => void;
  onPreviewClick?: (persona: BloggerPersona) => void;
  isLoading?: boolean;
}

export function PersonaSelector({
  personas,
  selectedPersonaId,
  onSelect,
  onCreateClick,
  onEditClick,
  onPreviewClick,
  isLoading = false,
}: PersonaSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Choose a Persona</h3>
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
        {personas.map((persona) => {
          const isSelected = selectedPersonaId === persona.id;
          const canEdit = isUserCreated(persona);

          return (
            <div
              key={persona.id}
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

              {/* System badge for non-editable personas */}
              {!canEdit && (
                <span className="absolute top-3 left-3 px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                  System
                </span>
              )}

              {/* Card content - clickable for selection */}
              <button
                type="button"
                onClick={() => onSelect(persona)}
                disabled={isLoading}
                className={`w-full text-left ${canEdit ? 'pr-8' : 'pr-8 pt-6'} ${isLoading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <h4 className="font-semibold text-gray-900 mb-1">{persona.name}</h4>
                <p className="text-xs text-blue-600 font-medium mb-2">{persona.role}</p>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{persona.bio}</p>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-700">Expertise:</p>
                  <p className="text-xs text-gray-600 line-clamp-2">{persona.expertise}</p>
                </div>
              </button>

              {/* Edit button - only for user-created personas */}
              {canEdit && onEditClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditClick(persona);
                  }}
                  className="absolute bottom-3 right-3 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Edit persona"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}

              {/* Preview button - for system personas */}
              {!canEdit && onPreviewClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewClick(persona);
                  }}
                  className="absolute bottom-3 right-3 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="View persona details"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {personas.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          No personas available. Please contact support.
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-gray-500">
          Loading personas...
        </div>
      )}
    </div>
  );
}
