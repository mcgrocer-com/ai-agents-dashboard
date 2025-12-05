/**
 * TemplateFormModal Component
 * Modal dialog for creating and editing blog templates
 */

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { BloggerTemplate, TemplateFormData } from '@/types/blogger';

interface TemplateFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: TemplateFormData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  template?: BloggerTemplate | null;
  saving?: boolean;
  readOnly?: boolean;
}

function getInitialFormData(template?: BloggerTemplate | null): TemplateFormData {
  if (!template) {
    return {
      name: '',
      description: '',
      h1_template: '',
      content_structure: '',
      seo_rules: '',
      prompt_template: '',
      notes: '',
    };
  }

  return {
    name: template.name,
    description: template.description,
    h1_template: template.h1_template || '',
    content_structure: template.content_structure,
    seo_rules: template.seo_rules || '',
    prompt_template: template.prompt_template || '',
    notes: template.notes || '',
  };
}

export function TemplateFormModal({
  open,
  onClose,
  onSave,
  onDelete,
  template,
  saving = false,
  readOnly = false,
}: TemplateFormModalProps) {
  const isEditMode = Boolean(template);
  const [formData, setFormData] = useState<TemplateFormData>(getInitialFormData(template));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setFormData(getInitialFormData(template));
    setShowDeleteConfirm(false);
  }, [template, open]);

  const handleChange = <K extends keyof TemplateFormData>(field: K, value: TemplateFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readOnly) {
      await onSave(formData);
    }
  };

  const handleDelete = async () => {
    if (template && onDelete) {
      await onDelete(template.id);
    }
  };

  // Determine title based on mode
  const getTitle = () => {
    if (readOnly) return `Preview: ${template?.name || 'Template'}`;
    return isEditMode ? 'Edit Template' : 'Create New Template';
  };

  // Common input class with read-only styling
  const inputClass = `w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`;
  const textareaClass = `w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`;
  const monoTextareaClass = `w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm ${readOnly ? 'bg-gray-50 cursor-not-allowed' : ''}`;

  return (
    <Dialog open={open} onClose={onClose} title={getTitle()}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Template Name <span className="text-red-500">*</span>
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
                placeholder="e.g., How-to Post, List Post"
              />
              <p className="mt-1 text-xs text-gray-500">Must be unique across all templates</p>
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                required
                minLength={10}
                maxLength={500}
                rows={3}
                readOnly={readOnly}
                className={textareaClass}
                placeholder="Describe the purpose and use case of this template..."
              />
            </div>
          </div>
        </div>

        {/* Content Structure */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Content Structure</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="h1_template" className="block text-sm font-medium text-gray-700 mb-1">
                H1 Template <span className="text-red-500">*</span>
              </label>
              <input
                id="h1_template"
                type="text"
                value={formData.h1_template}
                onChange={(e) => handleChange('h1_template', e.target.value)}
                required
                readOnly={readOnly}
                className={inputClass}
                placeholder="e.g., How to {{primary_keyword}}: A Complete Guide"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use {'{{primary_keyword}}'} as placeholder for the main keyword
              </p>
            </div>
            <div>
              <label htmlFor="content_structure" className="block text-sm font-medium text-gray-700 mb-1">
                Content Structure <span className="text-red-500">*</span>
              </label>
              <textarea
                id="content_structure"
                value={formData.content_structure}
                onChange={(e) => handleChange('content_structure', e.target.value)}
                required
                minLength={50}
                rows={6}
                readOnly={readOnly}
                className={monoTextareaClass}
                placeholder={`## Introduction
## H2: First Main Section
### H3: Subsection
## H2: Second Main Section
## Conclusion`}
              />
              <p className="mt-1 text-xs text-gray-500">
                Define the H2/H3 outline structure for the blog post
              </p>
            </div>
          </div>
        </div>

        {/* SEO & AI Configuration */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">SEO & AI Configuration</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="seo_rules" className="block text-sm font-medium text-gray-700 mb-1">
                SEO Rules <span className="text-red-500">*</span>
              </label>
              <textarea
                id="seo_rules"
                value={formData.seo_rules}
                onChange={(e) => handleChange('seo_rules', e.target.value)}
                required
                minLength={20}
                rows={4}
                readOnly={readOnly}
                className={textareaClass}
                placeholder={`- Primary keyword in H1 and first 100 words
- Secondary keywords in H2 headings
- Include internal links to related products
- CTA after key sections`}
              />
              <p className="mt-1 text-xs text-gray-500">
                Guidelines for SEO optimization when generating content
              </p>
            </div>
            <div>
              <label htmlFor="prompt_template" className="block text-sm font-medium text-gray-700 mb-1">
                AI Prompt Template <span className="text-red-500">*</span>
              </label>
              <textarea
                id="prompt_template"
                value={formData.prompt_template}
                onChange={(e) => handleChange('prompt_template', e.target.value)}
                required
                minLength={50}
                rows={8}
                readOnly={readOnly}
                className={monoTextareaClass}
                placeholder={`Write a detailed, human-like blog post about {{primary_keyword}}.

Persona: {{persona}}
Writing style: {{writing_style}}

Requirements:
- Minimum 1500 words
- Use conversational tone
- Include practical examples
- Follow E-E-A-T guidelines`}
              />
              <p className="mt-1 text-xs text-gray-500">
                Use {'{{persona}}'}, {'{{primary_keyword}}'}, {'{{writing_style}}'} as placeholders
              </p>
            </div>
          </div>
        </div>

        {/* Additional Notes */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Notes</h3>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              maxLength={500}
              rows={3}
              readOnly={readOnly}
              className={textareaClass}
              placeholder="Any additional notes or implementation details..."
            />
          </div>
        </div>

        {/* Delete Confirmation - only in edit mode, not read-only */}
        {!readOnly && showDeleteConfirm && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 mb-3">
              Are you sure you want to delete this template? This action cannot be undone.
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
                    <span>{isEditMode ? 'Save Changes' : 'Create Template'}</span>
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
