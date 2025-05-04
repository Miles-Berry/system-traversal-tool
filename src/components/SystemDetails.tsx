'use client';
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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
}

export default function SystemDetails(props: SystemDetailsProps) {
  const [systems, setSystems] = useState<System[] | null>(null);
  const [currentSystem, setCurrentSystem] = useState<System | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: ''
  });

  // Fetch current system details
  const fetchCurrentSystem = useCallback(async () => {
    try {
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

  // Fetch subsystems
  const fetchSystems = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('systems')
        .select('*')
        .eq('parent_id', props.systemId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching systems:', error);
      } else {
        setSystems(data);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  }, [props.systemId]);

  useEffect(() => {
    fetchCurrentSystem();
    fetchSystems();
  }, [fetchCurrentSystem, fetchSystems]);

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
      const newSystem = {
        name: formData.name,
        category: formData.category,
        parent_id: props.systemId
      };

      const { data, error } = await supabase
        .from('systems')
        .insert([newSystem])
        .select();

      if (error) {
        console.error('Error adding system:', error);
      } else {
        // Reset form and close modal
        setFormData({ name: '', category: '' });
        setIsAddModalOpen(false);
        // Fetch updated list
        fetchSystems();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  // Edit system
  const handleEditSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSystem) return;

    try {
      const { data, error } = await supabase
        .from('systems')
        .update({
          name: formData.name,
          category: formData.category
        })
        .eq('id', currentSystem.id)
        .select();

      if (error) {
        console.error('Error updating system:', error);
      } else {
        // Reset form and close modal
        setCurrentSystem(null);
        setFormData({ name: '', category: '' });
        setIsEditModalOpen(false);
        // Fetch updated list
        fetchSystems();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  // Delete system
  const handleDeleteSystem = async (id: string) => {
    if (confirm('Are you sure you want to delete this system?')) {
      try {
        const { error } = await supabase
          .from('systems')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting system:', error);
        } else {
          // Fetch updated list
          fetchSystems();
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      }
    }
  };

  // Handle system click for navigation
  const handleSystemClick = (system: System) => {
    if (props.onSystemSelect) {
      props.onSystemSelect(system.id, system.name);
    }
  };

  // Go back to parent system
  const handleGoToParent = async () => {
    if (currentSystem?.parent_id && props.onSystemSelect) {
      try {
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
    setCurrentSystem(system);
    setFormData({
      name: system.name,
      category: system.category
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="w-full h-[350px]">
      <div className="flex justify-between items-center">
        <h2 className="mx-3 mt-3 text-xl font-bold">
          {currentSystem?.name || 'System Details'}
        </h2>
        {currentSystem?.parent_id && (
          <button 
            onClick={handleGoToParent}
            className="mx-3 mt-3 text-sm border rounded-sm bg-gray-200 hover:bg-gray-300 px-2 py-1"
          >
            Go to Parent
          </button>
        )}
      </div>
      <h4 className="mx-3 text-md italic mt-0 mb-3">
        {currentSystem?.category || 'Category'}
      </h4>
      <div className="container flex flex-row justify-between">
        <h3 className="mx-3 text-lg font-bold">
          Subsystems
        </h3>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="mx-3 text-md font-bold border rounded-sm bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 px-2 py-1"
        >
          Add Child
        </button>
      </div>
      <ul className="border rounded-md overflow-y-scroll h-[233px] mx-3">
        {loading ? (
          <li className="p-2">Loading...</li>
        ) : !systems?.length ? (
          <li className="p-2">No subsystems found</li>
        ) : (
          systems.map((system) => (
            <li 
              key={system.id} 
              className="flex justify-between items-center p-2 border-b last:border-b-0 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleSystemClick(system)}
            >
              <div className="flex flex-col">
                <span className="text-md font-bold">{system.name}</span>
                <span className="text-sm italic">{system.category}</span>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => openEditModal(system, e)}
                  className="text-sm font-bold border rounded-sm bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 px-2 py-1"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSystem(system.id);
                  }}
                  className="text-sm font-bold border rounded-sm bg-red-500 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 px-2 py-1"
                >
                  Delete
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-md w-full max-w-md">
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
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded"
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
          <div className="bg-white p-4 rounded-md w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Edit Subsystem</h3>
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
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}