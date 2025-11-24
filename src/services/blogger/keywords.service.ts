/**
 * Blogger Keywords Service
 * Handles keyword research caching and management
 */

import { supabase } from '@/lib/supabase/client';
import type {
  BloggerKeyword,
  KeywordCompetition,
  ServiceResponse,
} from '@/types/blogger';

/**
 * Create or cache a keyword
 */
export async function cacheKeyword(
  keyword: Omit<BloggerKeyword, 'id' | 'created_at' | 'user_id'>
): Promise<ServiceResponse<BloggerKeyword>> {
  try {
    // Get current user
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

    // Check if keyword already exists for this topic and user
    const { data: existing, error: existingError } = await supabase
      .from('blogger_keywords')
      .select('*')
      .eq('keyword', keyword.keyword)
      .eq('topic', keyword.topic)
      .eq('user_id', user.id)
      .maybeSingle();

    // If found, return existing keyword
    if (existing) {
      return { data: existing, error: null, success: true };
    }

    // Ignore "not found" errors, but log other errors
    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking for existing keyword:', existingError);
    }

    // Convert numeric competition to string values for database
    let competition: KeywordCompetition = keyword.competition || 'medium';
    if (typeof competition === 'number') {
      competition = competition < 30 ? 'low' : competition < 70 ? 'medium' : 'high';
    }

    // Create new keyword
    const { data, error } = await supabase
      .from('blogger_keywords')
      .insert({
        ...keyword,
        competition,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error caching keyword:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error caching keyword:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Get cached keywords for a topic
 */
export async function getCachedKeywords(
  topic: string
): Promise<ServiceResponse<BloggerKeyword[]>> {
  try {
    // Get current user
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
      .from('blogger_keywords')
      .select('*')
      .eq('topic', topic)
      .eq('user_id', user.id)
      .order('search_volume', { ascending: false });

    if (error) {
      console.error('Error fetching cached keywords:', error);
      return { data: null, error, success: false };
    }

    return { data: data || [], error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching cached keywords:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Get a keyword by ID
 */
export async function getKeywordById(
  id: string
): Promise<ServiceResponse<BloggerKeyword>> {
  try {
    const { data, error } = await supabase
      .from('blogger_keywords')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching keyword:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching keyword:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Delete a cached keyword
 */
export async function deleteKeyword(id: string): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('blogger_keywords')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting keyword:', error);
      return { data: null, error, success: false };
    }

    return { data: null, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error deleting keyword:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}
