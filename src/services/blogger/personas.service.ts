/**
 * Blogger Personas Service
 * Handles CRUD operations for writer personas
 */

import { supabase } from '@/lib/supabase/client';
import type {
  BloggerPersona,
  ServiceResponse,
  CreatePersonaInput,
  UpdatePersonaInput,
} from '@/types/blogger';

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

/**
 * Create a new persona
 * Automatically sets user_id from current authenticated user
 */
export async function createPersona(
  input: CreatePersonaInput
): Promise<ServiceResponse<BloggerPersona>> {
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
      .from('blogger_personas')
      .insert({ ...input, user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error('Error creating persona:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error creating persona:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Update an existing persona
 * Only user-created personas can be updated (enforced by RLS)
 */
export async function updatePersona(
  id: string,
  input: UpdatePersonaInput
): Promise<ServiceResponse<BloggerPersona>> {
  try {
    const { data, error } = await supabase
      .from('blogger_personas')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating persona:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error updating persona:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Delete a persona by ID
 * Only user-created personas can be deleted (enforced by RLS)
 */
export async function deletePersona(id: string): Promise<ServiceResponse<null>> {
  try {
    const { error } = await supabase.from('blogger_personas').delete().eq('id', id);

    if (error) {
      console.error('Error deleting persona:', error);
      return { data: null, error, success: false };
    }

    return { data: null, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error deleting persona:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}
