/**
 * Blogger Templates Service
 * Handles CRUD operations for blog templates
 */

import { supabase } from '@/lib/supabase/client';
import type { BloggerTemplate, ServiceResponse } from '@/types/blogger';

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
