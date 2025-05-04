'use client';
import { useState, useEffect } from 'react';
import { getRevisionHistory, restoreRevision } from '@/lib/supabase';

interface RevisionHistoryProps {
  entityType: 'system' | 'interface';
  entityId: string;
  onClose: () => void;
  onRestore: () => void;
}

interface Revision {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  previous_data: any;
  new_data: any;
  created_at: string;
  created_by: string;
}

export default function RevisionHistory({
  entityType,
  entityId,
  onClose,
  onRestore
}: RevisionHistoryProps) {
  console.debug('Rendering RevisionHistory', { entityType, entityId });
  
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    async function fetchRevisions() {
      try {
        console.debug('Fetching revision history', { entityType, entityId });
        setLoading(true);
        
        const { data, error } = await getRevisionHistory(entityType, entityId);
        
        if (error) {
          console.error('Error fetching revision history:', error);
        } else {
          console.debug('Revision history fetched', { count: data?.length || 0 });
          setRevisions(data || []);
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchRevisions();
  }, [entityType, entityId]);

  const handleRestore = async () => {
    if (!selectedRevision) return;
    
    try {
      console.debug('Restoring to revision', { revisionId: selectedRevision });
      setRestoring(true);
      
      await restoreRevision(selectedRevision);
      
      console.debug('Restored successfully');
      onRestore();
      onClose();
    } catch (error) {
      console.error('Error restoring revision:', error);
    } finally {
      setRestoring(false);
    }
  };

  // Format date string to be more readable
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Render diff between versions to help visualize changes
  const renderDiff = (revision: Revision) => {
    if (revision.operation === 'create') {
      return (
        <div className="text-xs mt-1 bg-gray-700 p-2 rounded max-h-32 overflow-y-auto">
          <div className="text-green-400">+ {JSON.stringify(revision.new_data, null, 2)}</div>
        </div>
      );
    } else if (revision.operation === 'delete') {
      return (
        <div className="text-xs mt-1 bg-gray-700 p-2 rounded max-h-32 overflow-y-auto">
          <div className="text-red-400">- {JSON.stringify(revision.previous_data, null, 2)}</div>
        </div>
      );
    } else if (revision.operation === 'update') {
      // Only show the fields that changed
      const previousData = revision.previous_data || {};
      const newData = revision.new_data || {};
      const allKeys = [...new Set([...Object.keys(previousData), ...Object.keys(newData)])];
      
      return (
        <div className="text-xs mt-1 bg-gray-700 p-2 rounded max-h-32 overflow-y-auto">
          {allKeys.map(key => {
            const oldValue = previousData[key];
            const newValue = newData[key];
            
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
              return (
                <div key={key}>
                  <span className="font-bold">{key}: </span>
                  {oldValue !== undefined && (
                    <span className="text-red-400">- {JSON.stringify(oldValue)}</span>
                  )}
                  {oldValue !== undefined && newValue !== undefined && ' → '}
                  {newValue !== undefined && (
                    <span className="text-green-400">+ {JSON.stringify(newValue)}</span>
                  )}
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }
    
    return null;
  };

  // Get operation text with proper styling
  const getOperationStyle = (operation: string) => {
    switch (operation) {
      case 'create':
        return 'bg-green-500 text-white';
      case 'update':
        return 'bg-yellow-500 text-white';
      case 'delete':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };
  
  // Get operation friendly name
  const getOperationName = (operation: string) => {
    switch (operation) {
      case 'create':
        return 'Created';
      case 'update':
        return 'Updated';
      case 'delete':
        return 'Deleted';
      default:
        return operation;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="p-4 bg-white dark:bg-gray-800 rounded-md w-full max-w-2xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">
            Revision History - {entityType === 'system' ? 'System' : 'Interface'}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            &times;
          </button>
        </div>
        
        {loading ? (
          <div className="p-4 text-center">Loading revision history...</div>
        ) : revisions.length === 0 ? (
          <div className="p-4 text-center">No revision history found</div>
        ) : (
          <div className="mb-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {revisions.map((revision) => (
                <div 
                  key={revision.id}
                  className={`p-3 border rounded cursor-pointer transition-colors ${
                    selectedRevision === revision.id 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setSelectedRevision(revision.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getOperationStyle(revision.operation)}`}>
                        {getOperationName(revision.operation)}
                      </span>
                      <span className="ml-2 text-sm font-medium">
                        {formatDate(revision.created_at)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      by {revision.created_by}
                    </span>
                  </div>
                  
                  {renderDiff(revision)}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-end mt-4 gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleRestore}
            disabled={!selectedRevision || restoring}
            className={`px-3 py-1.5 rounded text-sm text-white ${
              !selectedRevision || restoring 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-700'
            }`}
          >
            {restoring ? 'Restoring...' : 'Restore to Selected Version'}
          </button>
        </div>
      </div>
    </div>
  );
}