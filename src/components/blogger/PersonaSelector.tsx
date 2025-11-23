/**
 * PersonaSelector Component
 * Displays all personas in a grid for selection
 */

import { Check } from 'lucide-react';
import type { BloggerPersona } from '@/types/blogger';

interface PersonaSelectorProps {
  personas: BloggerPersona[];
  selectedPersonaId: string | null;
  onSelect: (persona: BloggerPersona) => void;
  isLoading?: boolean;
}

export function PersonaSelector({
  personas,
  selectedPersonaId,
  onSelect,
  isLoading = false,
}: PersonaSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {personas.map((persona) => {
          const isSelected = selectedPersonaId === persona.id;

          return (
            <button
              key={persona.id}
              onClick={() => onSelect(persona)}
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
                <h4 className="font-semibold text-gray-900 mb-1">{persona.name}</h4>
                <p className="text-xs text-blue-600 font-medium mb-2">{persona.role}</p>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{persona.bio}</p>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-700">Expertise:</p>
                  <p className="text-xs text-gray-600 line-clamp-2">{persona.expertise}</p>
                </div>
              </div>
            </button>
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
