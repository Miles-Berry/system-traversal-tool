'use client'
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
    createSystemWithTransaction, 
    updateSystemWithTransaction, 
    deleteSystemWithTransaction
  } from '@/lib/supabase';
import RevisionHistory from './RevisionHistory';

interface SystemDetailsProps {
  systemId: string;
  onSystemSelect?: (id: string, name: string) => void;
}

interface System {
  id: string;
  name: string;
  category: string;
  parent_id?: string | null;
  created_at: string | null;
  depth?: number; // Added for hierarchy visualization
}

export default function SystemDetails(props: SystemDetailsProps) {
  console.debug('Rendering SystemDetails', { systemId: props.systemId });
  
  const [directChildren, setDirectChildren] = useState<System[] | null>(null);
  const [allDescendants, setAllDescendants] = useState<System[] | null>(null);
  const [currentSystem, setCurrentSystem] = useState<System | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedView, setSelectedView] = useState<'direct' | 'all'>('direct');
  const [formData, setFormData] = useState({
    name: '',
    category: ''
  });

  // Fetch current system details
  const fetchCurrentSystem = useCallback(async () => {
    try {
      console.debug('Fetching current system', { id: props.systemId });
      const { data, error } = await supabase
        .from('systems')
        .select('*')
        .eq('id', props.systemId)
        .single();
      
      if (error) {
        console.error('Error fetching current system:', error);
      } else {
        setCurrentSystem(data);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }, [props.systemId]);

  // Fetch children and grandchildren with depth information
  const fetchDescendants = useCallback(async () => {
    try {
      console.debug('Fetching descendants', { parentId: props.systemId });
      // Fetch direct children
      const { data: children, error: childrenError } = await supabase
        .from('systems')
        .select('*')
        .eq('parent_id', props.systemId);

      if (childrenError) {
        console.error('Error fetching children:', childrenError);
        return;
      }

      // Add depth information to direct children
      const childrenWithDepth = children.map(child => ({
        ...child,
        depth: 1
      }));
      
      setDirectChildren(childrenWithDepth);
      console.debug('Direct children fetched', { count: childrenWithDepth.length });

      // Fetch grandchildren for each direct child
      let allGrandchildren: System[] = [];
      
      for (const child of children) {
        const { data: grandchildren, error: grandchildrenError } = await supabase
          .from('systems')
          .select('*')
          .eq('parent_id', child.id);
          
        if (grandchildrenError) {
          console.error(`Error fetching grandchildren for ${child.id}:`, grandchildrenError);
          continue;
        }
        
        if (grandchildren && grandchildren.length > 0) {
          // Add depth information to grandchildren
          const grandchildrenWithDepth = grandchildren.map(grandchild => ({
            ...grandchild,
            depth: 2
          }));
          
          allGrandchildren = [...allGrandchildren, ...grandchildrenWithDepth];
        }
      }
      
      // Combine direct children and grandchildren for the "all" view
      setAllDescendants([...childrenWithDepth, ...allGrandchildren]);
      console.debug('All descendants fetched', { count: childrenWithDepth.length + allGrandchildren.length });
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  }, [props.systemId]);

  useEffect(() => {
    setLoading(true);
    fetchCurrentSystem();
    fetchDescendants();
  }, [fetchCurrentSystem, fetchDescendants]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add new system (child)
  const handleAddSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.debug('Adding new system', formData);
      
      const newSystemId = await createSystemWithTransaction(
        formData.name,
        formData.category,
        props.systemId // Parent ID
      );
      
      console.debug('System added successfully', { newSystemId });
      
      // Reset form and close modal
      setFormData({ name: '', category: '' });
      setIsAddModalOpen(false);
      
      // Fetch updated list
      fetchDescendants();
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  // Edit system
  const handleEditSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSystem) return;
  
    try {
      console.debug('Editing system', { id: currentSystem.id, formData });
      
      const updatedSystemData = await updateSystemWithTransaction(
        currentSystem.id,
        formData.name,
        formData.category
      );
      
      console.debug('System updated successfully', updatedSystemData);
      
      // Reset form and close modal
      setFormData({ name: '', category: '' });
      setIsEditModalOpen(false);
      
      // Fetch updated data
      fetchCurrentSystem();
      fetchDescendants();
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  // Delete system
  const handleDeleteSystem = async (id: string) => {
    if (confirm('Are you sure you want to delete this system? This action cannot be undone.')) {
      try {
        console.debug('Deleting system', { id });
        
        await deleteSystemWithTransaction(id);
        
        console.debug('System deleted successfully');
        
        // Fetch updated list
        fetchDescendants();
      } catch (error) {
        console.error('Unexpected error:', error);
      }
    }
  };

  // Handle system click for navigation
  const handleSystemClick = (system: System) => {
    console.debug('System clicked for navigation', { id: system.id, name: system.name });
    if (props.onSystemSelect) {
      props.onSystemSelect(system.id, system.name);
    }
  };

  // Go back to parent system
  const handleGoToParent = async () => {
    if (currentSystem?.parent_id && props.onSystemSelect) {
      try {
        console.debug('Navigating to parent system', { parentId: currentSystem.parent_id });
        const { data, error } = await supabase
          .from('systems')
          .select('*')
          .eq('id', currentSystem.parent_id)
          .single();
        
        if (error) {
          console.error('Error fetching parent system:', error);
        } else {
          props.onSystemSelect(data.id, data.name);
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      }
    }
  };

  // Open edit modal with system data
  const openEditModal = (system: System, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the row click
    console.debug('Opening edit modal', { id: system.id, name: system.name });
    setCurrentSystem(system);
    setFormData({
      name: system.name,
      category: system.category
    });
    setIsEditModalOpen(true);
  };

  // Get indentation based on depth
  const getIndentation = (depth: number = 0) => {
    return `pl-${Math.min(depth * 3, 6)}`;
  };

  // Render a system item
  const renderSystemItem = (system: System) => (
    <li 
      key={system.id} 
      className={`flex justify-between items-center py-1 px-2 border-b last:border-b-0 hover:bg-gray-600 cursor-pointer ${system.depth ? getIndentation(system.depth) : ''}`}
      onClick={() => handleSystemClick(system)}
    >
      <div className="flex flex-col">
        <div className="flex items-center">
          {system.depth === 2 && (
            <span className="mr-1 text-gray-400 text-sm">
              →
            </span>
          )}
          <span className="text-sm font-medium">{system.name}</span>
        </div>
        <span className="text-xs italic text-gray-500">{system.category}</span>
      </div>
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentSystem(system);
            setIsHistoryModalOpen(true);
          }}
          className="text-xs font-medium border rounded-sm bg-gray-500 text-white hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:ring-opacity-50 px-1.5 py-0.5"
        >
          History
        </button>
        <button
          onClick={(e) => openEditModal(system, e)}
          className="text-xs font-medium border rounded-sm bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-opacity-50 px-1.5 py-0.5"
        >
          Edit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteSystem(system.id);
          }}
          className="text-xs font-medium border rounded-sm bg-red-500 text-white hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 focus:ring-opacity-50 px-1.5 py-0.5"
        >
          Delete
        </button>
      </div>
    </li>
  );

  return (
    <div className="w-full h-[250px]">
      <div className="flex justify-between items-center p-2 border-b">
        <div>
          <h2 className="text-lg font-bold">
            {currentSystem?.name || 'System Details'}
          </h2>
          <h4 className="text-xs italic text-gray-500">
            {currentSystem?.category || 'Category'}
          </h4>
        </div>
        <div className="flex gap-2">
            {currentSystem && (
            <button 
                onClick={() => {
                console.debug('Opening edit modal for current system', { id: currentSystem.id });
                setFormData({
                    name: currentSystem.name,
                    category: currentSystem.category
                });
                setIsEditModalOpen(true);
                }}
                className="text-xs font-medium border rounded-sm bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-opacity-50 px-2 py-1"
            >
                Edit System
            </button>
            )}
          {currentSystem && (
            <button 
              onClick={() => setIsHistoryModalOpen(true)}
              className="text-xs border rounded-sm bg-gray-500 text-white hover:bg-gray-700 px-2 py-1"
            >
              View History
            </button>
          )}
          {currentSystem?.parent_id && (
            <button 
              onClick={handleGoToParent}
              className="text-xs border rounded-sm hover:bg-gray-300 px-2 py-1"
            >
              Go to Parent
            </button>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center px-2 py-1">
        <div className="flex items-center">
          <h3 className="text-sm font-bold mr-2">
            Subsystems
          </h3>
          <div className="flex space-x-1 text-xs">
            <button
              onClick={() => setSelectedView('direct')}
              className={`px-1.5 py-0.5 rounded ${selectedView === 'direct' ? 'bg-blue-500 text-white' : 'bg-gray-600'}`}
            >
              Direct
            </button>
            <button
              onClick={() => setSelectedView('all')}
              className={`px-1.5 py-0.5 rounded ${selectedView === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-600'}`}
            >
              All
            </button>
          </div>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="text-xs font-medium border rounded-sm bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-opacity-50 px-2 py-1"
        >
          Add Child
        </button>
      </div>
      
      <ul className="border-t overflow-y-auto max-h-full">
        {loading ? (
          <li className="p-2 text-sm">Loading...</li>
        ) : selectedView === 'direct' ? (
          !directChildren?.length ? (
            <li className="p-2 text-sm text-gray-500">No direct subsystems found</li>
          ) : (
            directChildren.map(system => renderSystemItem(system))
          )
        ) : (
          !allDescendants?.length ? (
            <li className="p-2 text-sm text-gray-500">No descendant systems found</li>
          ) : (
            allDescendants.map(system => renderSystemItem(system))
          )
        )}
      </ul>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="p-4 rounded-md w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add New Subsystem</h3>
            <form onSubmit={handleAddSystem}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Category</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ name: '', category: '' });
                    setIsAddModalOpen(false);
                  }}
                  className="px-3 py-1.5 border rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-500 text-white rounded"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="p-4 rounded-md w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Edit System</h3>
            <form onSubmit={handleEditSystem}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Category</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentSystem(null);
                    setFormData({ name: '', category: '' });
                    setIsEditModalOpen(false);
                  }}
                  className="px-3 py-1.5 border rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-500 text-white rounded"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revision History Modal */}
      {isHistoryModalOpen && currentSystem && (
        <RevisionHistory
          entityType="system"
          entityId={currentSystem.id}
          onClose={() => setIsHistoryModalOpen(false)}
          onRestore={() => {
            fetchCurrentSystem();
            fetchDescendants();
          }}
        />
      )}
    </div>
  );
}