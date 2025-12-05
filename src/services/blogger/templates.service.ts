/**
 * Blogger Templates Service
 * Handles CRUD operations for blog templates
 */

import { supabase } from '@/lib/supabase/client';
import type {
  BloggerTemplate,
  ServiceResponse,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '@/types/blogger';

/**
 * Get all templates
 * Public read access - all authenticated users can view
 */
export async function getAllTemplates(): Promise<
  ServiceResponse<BloggerTemplate[]>
> {
  try {
    const { data, error } = await supabase
      .from('blogger_templates')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching templates:', error);
      return { data: null, error, success: false };
    }

    return { data: data || [], error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching templates:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(
  id: string
): Promise<ServiceResponse<BloggerTemplate>> {
  try {
    const { data, error } = await supabase
      .from('blogger_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching template:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Get a template by name
 */
export async function getTemplateByName(
  name: string
): Promise<ServiceResponse<BloggerTemplate>> {
  try {
    const { data, error } = await supabase
      .from('blogger_templates')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      console.error('Error fetching template by name:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching template by name:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Create a new template
 * Automatically sets user_id from current authenticated user
 */
export async function createTemplate(
  input: CreateTemplateInput
): Promise<ServiceResponse<BloggerTemplate>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: new Error('User not authenticated'),
        success: false,
      };
    }

    const { data, error } = await supabase
      .from('blogger_templates')
      .insert({ ...input, user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error creating template:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Update an existing template
 * Only user-created templates can be updated (enforced by RLS)
 */
export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput
): Promise<ServiceResponse<BloggerTemplate>> {
  try {
    const { data, error } = await supabase
      .from('blogger_templates')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error updating template:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Delete a template by ID
 * Only user-created templates can be deleted (enforced by RLS)
 */
export async function deleteTemplate(id: string): Promise<ServiceResponse<null>> {
  try {
    const { error } = await supabase.from('blogger_templates').delete().eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      return { data: null, error, success: false };
    }

    return { data: null, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error deleting template:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}
