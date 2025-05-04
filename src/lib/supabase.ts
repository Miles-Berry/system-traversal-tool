import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Create Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Define types for revision data
export interface RevisionData {
  [key: string]: string | number | boolean | null | RevisionData;
}

/**
 * Execute a multi-statement client-side transaction
 * Since Supabase JS client doesn't support transactions directly,
 * we'll implement a client-side transaction pattern with error handling
 */
export async function executeTransaction<T>(
  callback: (client: typeof supabase) => Promise<T>
): Promise<T> {
  console.debug('Starting client-side transaction');
  
  try {
    // Execute the callback function with the client
    const result = await callback(supabase);
    console.debug('Transaction operations executed successfully');
    
    return result;
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

/**
 * Create a revision record for an entity
 */
export async function createRevision(
  entityType: 'system' | 'interface',
  entityId: string,
  operation: 'create' | 'update' | 'delete',
  previousData: RevisionData | null, // Replace any with a proper type
  newData: RevisionData | null, // Replace any with a proper type
  userId: string = 'anonymous'
) {
  console.debug('Creating revision record', {
    entityType,
    entityId,
    operation,
    previousData,
    newData
  });
  
  const { data, error } = await supabase
    .from('revisions')
    .insert([
      {
        entity_type: entityType,
        entity_id: entityId,
        operation,
        previous_data: previousData,
        new_data: newData,
        created_by: userId,
        created_at: new Date().toISOString()
      }
    ]);
    
  if (error) {
    console.error('Error creating revision record:', error);
  }
  
  return { data, error };
}

/**
 * Get revision history for an entity
 */
export async function getRevisionHistory(
  entityType: 'system' | 'interface',
  entityId: string
) {
  console.debug('Fetching revision history', { entityType, entityId });
  
  const { data, error } = await supabase
    .from('revisions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching revision history:', error);
  }
  
  return { data, error };
}

/**
 * Server-side functions for transaction-safe operations
 * These call PostgreSQL functions that run in a transaction
 */

/**
 * Create a system with transactional guarantees
 */
export async function createSystemWithTransaction(
  name: string,
  category: string,
  parentId: string | null = null
) {
  console.debug('Creating system with transaction', { name, category, parentId });
  
  const { data, error } = await supabase
    .rpc('create_system_with_history', { 
      system_name: name,
      system_category: category,
      system_parent_id: parentId ?? undefined
    });
  
  if (error) {
    console.error('Error creating system:', error);
    throw error;
  }
  
  return data;
}

/**
 * Update a system with transactional guarantees
 */
export async function updateSystemWithTransaction(
  systemId: string,
  name: string,
  category: string
) {
  console.debug('Updating system with transaction', { systemId, name, category });
  
  const { data, error } = await supabase
    .rpc('update_system_with_history', { 
      system_id: systemId,
      system_name: name,
      system_category: category
    });
  
  if (error) {
    console.error('Error updating system:', error);
    throw error;
  }
  
  return data;
}

/**
 * Delete a system with transactional guarantees
 */
export async function deleteSystemWithTransaction(
  systemId: string
) {
  console.debug('Deleting system with transaction', { systemId });
  
  const { data, error } = await supabase
    .rpc('delete_system_with_history', { 
      system_id: systemId
    });
  
  if (error) {
    console.error('Error deleting system:', error);
    throw error;
  }
  
  return data;
}

/**
 * Create an interface with transactional guarantees
 */
export async function createInterfaceWithTransaction(
  system1Id: string,
  system2Id: string,
  connection: string,
  directional: number = 0
) {
  console.debug('Creating interface with transaction', { 
    system1Id, 
    system2Id, 
    connection, 
    directional 
  });
  
  const { data, error } = await supabase
    .rpc('create_interface_with_history', { 
      interface_system1_id: system1Id,
      interface_system2_id: system2Id,
      interface_connection: connection,
      interface_directional: directional
    });
  
  if (error) {
    console.error('Error creating interface:', error);
    throw error;
  }
  
  return data;
}

/**
 * Update an interface with transactional guarantees
 */
export async function updateInterfaceWithTransaction(
  interfaceId: string,
  system1Id: string,
  system2Id: string,
  connection: string,
  directional: number
) {
  console.debug('Updating interface with transaction', { 
    interfaceId,
    system1Id, 
    system2Id, 
    connection, 
    directional 
  });
  
  const { data, error } = await supabase
    .rpc('update_interface_with_history', { 
      interface_id: interfaceId,
      interface_system1_id: system1Id,
      interface_system2_id: system2Id,
      interface_connection: connection,
      interface_directional: directional
    });
  
  if (error) {
    console.error('Error updating interface:', error);
    throw error;
  }
  
  return data;
}

/**
 * Delete an interface with transactional guarantees
 */
export async function deleteInterfaceWithTransaction(
  interfaceId: string
) {
  console.debug('Deleting interface with transaction', { interfaceId });
  
  const { data, error } = await supabase
    .rpc('delete_interface_with_history', { 
      interface_id: interfaceId
    });
  
  if (error) {
    console.error('Error deleting interface:', error);
    throw error;
  }
  
  return data;
}

/**
 * Restore entity to a specific revision using stored procedure
 */
export async function restoreRevision(
  revisionId: string
) {
  console.debug('Restoring to revision', { revisionId });
  
  const { data, error } = await supabase
    .rpc('restore_revision', { revision_id: revisionId });
  
  if (error) {
    console.error('Error restoring revision:', error);
    throw error;
  }
  
  return data;
}