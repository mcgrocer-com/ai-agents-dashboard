/**
 * Blogger Personas Service
 * Handles CRUD operations for writer personas
 */

import { supabase } from '@/lib/supabase/client';
import type { BloggerPersona, ServiceResponse } from '@/types/blogger';

/**
 * Get all personas
 * Public read access - all authenticated users can view
 */
export async function getAllPersonas(): Promise<ServiceResponse<BloggerPersona[]>> {
  try {
    const { data, error } = await supabase
      .from('blogger_personas')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching personas:', error);
      return { data: null, error, success: false };
    }

    return { data: data || [], error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching personas:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Get a single persona by ID
 */
export async function getPersonaById(
  id: string
): Promise<ServiceResponse<BloggerPersona>> {
  try {
    const { data, error } = await supabase
      .from('blogger_personas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching persona:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching persona:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Get personas by best-fit template
 * Useful for filtering personas based on selected template
 */
export async function getPersonasByTemplate(
  templateName: string
): Promise<ServiceResponse<BloggerPersona[]>> {
  try {
    const { data, error } = await supabase
      .from('blogger_personas')
      .select('*')
      .contains('context_data', { best_templates: [templateName] })
      .order('name');

    if (error) {
      console.error('Error fetching personas by template:', error);
      return { data: null, error, success: false };
    }

    return { data: data || [], error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching personas by template:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}
