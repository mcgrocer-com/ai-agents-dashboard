/**
 * PersonaFormModal Component
 * Modal dialog for creating and editing blogger personas
 */

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { BloggerPersona, PersonaFormData } from '@/types/blogger';

interface PersonaFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: PersonaFormData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  persona?: BloggerPersona | null;
  availableTemplates: string[];
  saving?: boolean;
  readOnly?: boolean;
}

function getInitialFormData(persona?: BloggerPersona | null): PersonaFormData {
  if (!persona) {
    return {
      name: '',
      role: '',
      bio: '',
      expertise: '',
      years_experience: 0,
      location: '',
      background: '',
      credentials: '',
      writing_style: '',
      specialty: '',
      methodology: '',
      purpose: '',
      career_milestone: '',
      best_templates: [],
    };
  }

  const ctx = persona.context_data;
  return {
    name: persona.name,
    role: persona.role,
    bio: persona.bio,
    expertise: persona.expertise,
    years_experience: ctx?.years_experience || 0,
    location: ctx?.location || '',
    background: ctx?.background || '',
    credentials: ctx?.credentials || '',
    writing_style: ctx?.writing_style || '',
    specialty: ctx?.specialty || '',
    methodology: ctx?.methodology || '',
    purpose: ctx?.purpose || '',
    career_milestone: ctx?.career_milestone || '',
    best_templates: ctx?.best_templates || [],
  };
}

export function PersonaFormModal({
  open,
  onClose,
  onSave,
  onDelete,
  persona,
  availableTemplates,
  saving = false,
  readOnly = false,
}: PersonaFormModalProps) {
  const isEditMode = Boolean(persona);
  const [formData, setFormData] = useState<PersonaFormData>(getInitialFormData(persona));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setFormData(getInitialFormData(persona));
    setShowDeleteConfirm(false);
  }, [persona, open]);

  // Determine title based on mode
  const getTitle = () => {
    if (readOnly) return `Preview: ${persona?.name || 'Persona'}`;
    return isEditMode ? 'Edit Persona' : 'Create New Persona';
  };

  const handleChange = <K extends keyof PersonaFormData>(field: K, value: PersonaFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTemplateToggle = (templateName: string) => {
    setFormData((prev) => ({
      ...prev,
      best_templates: prev.best_templates.includes(templateName)
        ? prev.best_templates.filter((t) => t !== templateName)
        : [...prev.best_templates, templateName],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readOnly) {
      await onSave(formData);
    }
  };

  const handleDelete = async () => {
    if (persona && onDelete) {
      await onDelete(persona.id);
    }
  };

  // Common input class with read-only styling
  const inputClass = `w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`;
  const textareaClass = `w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`;

  return (
    <Dialog open={open} onClose={onClose} title={getTitle()}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                minLength={2}
                maxLength={100}
                readOnly={readOnly}
                className={inputClass}
                placeholder="e.g., Alex Thompson"
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <input
                id="role"
                type="text"
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                required
                minLength={2}
                maxLength={100}
                readOnly={readOnly}
                className={inputClass}
                placeholder="e.g., Food & Lifestyle Writer"
              />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
              Bio <span className="text-red-500">*</span>
            </label>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              required
              minLength={20}
              maxLength={500}
              rows={3}
              readOnly={readOnly}
              className={textareaClass}
              placeholder="Brief biography describing the persona's background..."
            />
          </div>
          <div className="mt-4">
            <label htmlFor="expertise" className="block text-sm font-medium text-gray-700 mb-1">
              Expertise <span className="text-red-500">*</span>
            </label>
            <textarea
              id="expertise"
              value={formData.expertise}
              onChange={(e) => handleChange('expertise', e.target.value)}
              required
              minLength={10}
              maxLength={300}
              rows={2}
              readOnly={readOnly}
              className={textareaClass}
              placeholder="Areas of expertise..."
            />
          </div>
        </div>

        {/* Professional Context */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Professional Context</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="years_experience" className="block text-sm font-medium text-gray-700 mb-1">
                Years of Experience
              </label>
              <input
                id="years_experience"
                type="number"
                min={0}
                max={50}
                value={formData.years_experience}
                onChange={(e) => handleChange('years_experience', parseInt(e.target.value) || 0)}
                readOnly={readOnly}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                id="location"
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                maxLength={100}
                readOnly={readOnly}
                className={inputClass}
                placeholder="e.g., London, UK"
              />
            </div>
            <div>
              <label htmlFor="background" className="block text-sm font-medium text-gray-700 mb-1">
                Background
              </label>
              <input
                id="background"
                type="text"
                value={formData.background}
                onChange={(e) => handleChange('background', e.target.value)}
                maxLength={200}
                readOnly={readOnly}
                className={inputClass}
                placeholder="Professional background..."
              />
            </div>
            <div>
              <label htmlFor="credentials" className="block text-sm font-medium text-gray-700 mb-1">
                Credentials
              </label>
              <input
                id="credentials"
                type="text"
                value={formData.credentials}
                onChange={(e) => handleChange('credentials', e.target.value)}
                maxLength={200}
                readOnly={readOnly}
                className={inputClass}
                placeholder="Degrees, certifications..."
              />
            </div>
          </div>
        </div>

        {/* Writing Style */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Writing Style</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="writing_style" className="block text-sm font-medium text-gray-700 mb-1">
                Tone & Voice
              </label>
              <input
                id="writing_style"
                type="text"
                value={formData.writing_style}
                onChange={(e) => handleChange('writing_style', e.target.value)}
                maxLength={300}
                readOnly={readOnly}
                className={inputClass}
                placeholder="e.g., warm, conversational, informative"
              />
            </div>
            <div>
              <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 mb-1">
                Specialty
              </label>
              <input
                id="specialty"
                type="text"
                value={formData.specialty}
                onChange={(e) => handleChange('specialty', e.target.value)}
                maxLength={200}
                readOnly={readOnly}
                className={inputClass}
                placeholder="Content specialty..."
              />
            </div>
            <div>
              <label htmlFor="methodology" className="block text-sm font-medium text-gray-700 mb-1">
                Methodology
              </label>
              <textarea
                id="methodology"
                value={formData.methodology}
                onChange={(e) => handleChange('methodology', e.target.value)}
                maxLength={300}
                rows={2}
                readOnly={readOnly}
                className={textareaClass}
                placeholder="Research and writing methodology..."
              />
            </div>
          </div>
        </div>

        {/* Professional Goals */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Professional Goals</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
                Purpose
              </label>
              <textarea
                id="purpose"
                value={formData.purpose}
                onChange={(e) => handleChange('purpose', e.target.value)}
                maxLength={300}
                rows={2}
                readOnly={readOnly}
                className={textareaClass}
                placeholder="Content purpose and goals..."
              />
            </div>
            <div>
              <label htmlFor="career_milestone" className="block text-sm font-medium text-gray-700 mb-1">
                Career Milestone
              </label>
              <textarea
                id="career_milestone"
                value={formData.career_milestone}
                onChange={(e) => handleChange('career_milestone', e.target.value)}
                maxLength={300}
                rows={2}
                readOnly={readOnly}
                className={textareaClass}
                placeholder="Notable career achievement..."
              />
            </div>
          </div>
        </div>

        {/* Template Compatibility */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Best Templates</h3>
          <p className="text-xs text-gray-500 mb-3">Select templates this persona excels with</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {availableTemplates.map((template) => (
              <label key={template} className={`flex items-center gap-2 ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={formData.best_templates.includes(template)}
                  onChange={() => !readOnly && handleTemplateToggle(template)}
                  disabled={readOnly}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700">{template}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Delete Confirmation - only in edit mode, not read-only */}
        {!readOnly && showDeleteConfirm && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 mb-3">
              Are you sure you want to delete this persona? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Yes, Delete
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-4 border-t border-gray-200">
          <div>
            {!readOnly && isEditMode && onDelete && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {readOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{isEditMode ? 'Save Changes' : 'Create Persona'}</span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
