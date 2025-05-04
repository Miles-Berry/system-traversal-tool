'use client';
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  createInterfaceWithTransaction, 
  updateInterfaceWithTransaction, 
  deleteInterfaceWithTransaction,
  getRevisionHistory
} from '@/lib/supabase';

interface InterfacePanelProps {
  systemId: string;
}

interface System {
  id: string;
  name: string;
  category: string;
  depth?: number;
}

interface Interface {
  id: string;
  system1_id: string;
  system2_id: string;
  connection: string;
  directional: number;
  created_at: string | null;
  system1?: System | null;
  system2?: System | null;
}

export default function InterfacePanel({ systemId }: InterfacePanelProps) {
  console.debug('Rendering InterfacePanel', { systemId });
  
  const [interfaces, setInterfaces] = useState<Interface[]>([]);
  const [loading, setLoading] = useState(true);
  const [directChildren, setDirectChildren] = useState<System[]>([]);
  const [grandchildren, setGrandchildren] = useState<System[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentInterface, setCurrentInterface] = useState<Interface | null>(null);
  const [activeTab, setActiveTab] = useState<'direct' | 'children' | 'grandchildren'>('direct');
  const [formData, setFormData] = useState({
    system1_id: '',
    system2_id: '',
    connection: '',
    directional: 0
  });

  // Fetch direct children and grandchildren
  const fetchDescendants = useCallback(async () => {
    try {
      console.debug('Fetching descendants for interface panel', { systemId });
      // Fetch direct children
      const { data: children, error: childrenError } = await supabase
        .from('systems')
        .select('*')
        .eq('parent_id', systemId);

      if (childrenError) {
        console.error('Error fetching children:', childrenError);
        return [];
      }

      // Add depth information 
      const childrenWithDepth = children.map(child => ({
        ...child,
        depth: 1
      }));
      
      setDirectChildren(childrenWithDepth);
      console.debug('Direct children fetched', { count: childrenWithDepth.length });

      // Fetch grandchildren for each direct child
      let allGrandchildren: System[] = [];
      
      for (const child of children) {
        const { data: grandchildData, error: grandchildrenError } = await supabase
          .from('systems')
          .select('*')
          .eq('parent_id', child.id);
          
        if (grandchildrenError) {
          console.error(`Error fetching grandchildren for ${child.id}:`, grandchildrenError);
          continue;
        }
        
        if (grandchildData && grandchildData.length > 0) {
          const grandchildrenWithDepth = grandchildData.map(grandchild => ({
            ...grandchild,
            depth: 2
          }));
          
          allGrandchildren = [...allGrandchildren, ...grandchildrenWithDepth];
        }
      }
      
      setGrandchildren(allGrandchildren);
      console.debug('Grandchildren fetched', { count: allGrandchildren.length });
      
      return [...childrenWithDepth, ...allGrandchildren];
    } catch (error) {
      console.error('Unexpected error:', error);
      return [];
    }
  }, [systemId]);

  // Fetch all interfaces related to the current system and its descendants
  const fetchInterfaces = useCallback(async () => {
    try {
      console.debug('Fetching interfaces', { systemId });
      setLoading(true);
      
      // Get all descendant systems
      const descendants = await fetchDescendants();
      
      // Get all relevant system IDs (current + descendants)
      const allSystemIds = [systemId, ...(descendants || []).map(s => s.id)];
      
      if (allSystemIds.length === 0) {
        setInterfaces([]);
        setLoading(false);
        return;
      }
      
      // Fetch interfaces where system1 or system2 is in our list
      const { data: interfacesData, error: interfacesError } = await supabase
        .from('interfaces')
        .select('*')
        .or(`system1_id.in.(${allSystemIds.join(',')}),system2_id.in.(${allSystemIds.join(',')})`);
        
      if (interfacesError) {
        console.error('Error fetching interfaces:', interfacesError);
        setLoading(false);
        return;
      }
      
      console.debug('Interfaces fetched', { count: interfacesData?.length || 0 });
      
      // For each interface, fetch the connected systems' details
      const enrichedInterfaces = await Promise.all(
        (interfacesData || []).map(async (iface) => {
          const { data: system1Data, error: system1Error } = await supabase
            .from('systems')
            .select('*')
            .eq('id', iface.system1_id)
            .single();
          
          const { data: system2Data, error: system2Error } = await supabase
            .from('systems')
            .select('*')
            .eq('id', iface.system2_id)
            .single();
            
          return {
            ...iface,
            system1: system1Error ? null : system1Data,
            system2: system2Error ? null : system2Data
          };
        })
      );
      
      setInterfaces(enrichedInterfaces);
    } catch (error) {
      console.error('Error in fetchInterfaces:', error);
    } finally {
      setLoading(false);
    }
  }, [systemId, fetchDescendants]);

  useEffect(() => {
    fetchInterfaces();
  }, [fetchInterfaces]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'directional' ? parseInt(value) : value
    }));
  };

  // Add new interface
  const handleAddInterface = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.debug('Adding new interface', formData);
      
      const newInterfaceId = await createInterfaceWithTransaction(
        formData.system1_id,
        formData.system2_id,
        formData.connection,
        formData.directional
      );
      
      console.debug('Interface added successfully', { newInterfaceId });
      
      // Reset form and close modal
      setFormData({ system1_id: '', system2_id: '', connection: '', directional: 0 });
      setIsAddModalOpen(false);
      
      // Fetch updated list
      fetchInterfaces();
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  // Edit interface
  const handleEditInterface = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInterface) return;
  
    try {
      console.debug('Editing interface', { id: currentInterface.id, formData });
      
      const updatedInterfaceData = await updateInterfaceWithTransaction(
        currentInterface.id,
        formData.system1_id,
        formData.system2_id,
        formData.connection,
        formData.directional
      );
      
      console.debug('Interface updated successfully', updatedInterfaceData);
      
      // Reset form and close modal
      setCurrentInterface(null);
      setFormData({ system1_id: '', system2_id: '', connection: '', directional: 0 });
      setIsEditModalOpen(false);
      
      // Fetch updated list
      fetchInterfaces();
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  // Delete interface
  const handleDeleteInterface = async (id: string) => {
    if (confirm('Are you sure you want to delete this interface? This action cannot be undone.')) {
      try {
        console.debug('Deleting interface', { id });
        
        await deleteInterfaceWithTransaction(id);
        
        console.debug('Interface deleted successfully');
        
        // Fetch updated list
        fetchInterfaces();
      } catch (error) {
        console.error('Unexpected error:', error);
      }
    }
  };
  
  // Open edit modal with interface data
  const openEditModal = (iface: Interface) => {
    console.debug('Opening edit interface modal', { id: iface.id });
    setCurrentInterface(iface);
    setFormData({
      system1_id: iface.system1_id,
      system2_id: iface.system2_id,
      connection: iface.connection,
      directional: iface.directional
    });
    setIsEditModalOpen(true);
  };

  // Get all available systems for dropdowns
  const getAvailableSystems = () => {
    const connectedExternalSystems: System[] = [];
    
    // Find external systems (those that are connected but not in our descendant list)
    interfaces.forEach(iface => {
      // For system1
      if (!directChildren.some(s => s.id === iface.system1_id) && 
          !grandchildren.some(s => s.id === iface.system1_id) &&
          iface.system1_id !== systemId &&
          !connectedExternalSystems.some(s => s.id === iface.system1_id) &&
          iface.system1) {
        connectedExternalSystems.push(iface.system1);
      }
      
      // For system2
      if (!directChildren.some(s => s.id === iface.system2_id) && 
          !grandchildren.some(s => s.id === iface.system2_id) &&
          iface.system2_id !== systemId &&
          !connectedExternalSystems.some(s => s.id === iface.system2_id) &&
          iface.system2) {
        connectedExternalSystems.push(iface.system2);
      }
    });
    
    // Find the current system in the interfaces
    const currentSystemData = interfaces.find(
      iface => iface.system1_id === systemId || iface.system2_id === systemId
    );
    
    // Get current system
    const currentSystem: System = {
      id: systemId,
      name: (currentSystemData?.system1_id === systemId && currentSystemData?.system1?.name) ||
            (currentSystemData?.system2_id === systemId && currentSystemData?.system2?.name) ||
            'Current System',
      category: (currentSystemData?.system1_id === systemId && currentSystemData?.system1?.category) ||
               (currentSystemData?.system2_id === systemId && currentSystemData?.system2?.category) ||
               ''
    };
    
    // Combine all systems
    return [currentSystem, ...directChildren, ...grandchildren, ...connectedExternalSystems];
  };

  // Group interfaces by level of relationship
  const groupInterfacesByLevel = () => {
    const directInterfaces: Interface[] = [];
    const childrenInterfaces: Interface[] = [];
    const grandchildrenInterfaces: Interface[] = [];
    
    interfaces.forEach(iface => {
      // Direct interfaces involve the current system
      if (iface.system1_id === systemId || iface.system2_id === systemId) {
        directInterfaces.push(iface);
      }
      // Children interfaces involve direct children but not the current system
      else if (
        (directChildren.some(child => child.id === iface.system1_id) || 
         directChildren.some(child => child.id === iface.system2_id))
      ) {
        childrenInterfaces.push(iface);
      }
      // Grandchildren interfaces only involve grandchildren
      else {
        grandchildrenInterfaces.push(iface);
      }
    });
    
    return { directInterfaces, childrenInterfaces, grandchildrenInterfaces };
  };

  const { directInterfaces, childrenInterfaces, grandchildrenInterfaces } = groupInterfacesByLevel();

  // Render interface table for a specific group
  const renderInterfaceTable = (interfaceGroup: Interface[]) => {
    if (interfaceGroup.length === 0) {
      return <div className="p-2 text-sm text-center">No interfaces found</div>;
    }
    
    return (
      <table className="min-w-full divide-y divide-gray-200 interface-table">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider">From</th>
            <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider">To</th>
            <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider">Connection</th>
            <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider">Type</th>
            <th className="px-2 py-2 text-right text-xs font-medium uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {interfaceGroup.map((iface) => (
            <tr key={iface.id} className="hover:bg-gray-600">
              <td className="px-2 py-2 whitespace-nowrap">
                <div className="flex flex-col">
                  <div className="text-xs font-medium">{iface.system1?.name || 'Unknown'}</div>
                  <div className="text-xs italic">{iface.system1?.category || ''}</div>
                </div>
              </td>
              <td className="px-2 py-2 whitespace-nowrap">
                <div className="flex flex-col">
                  <div className="text-xs font-medium">{iface.system2?.name || 'Unknown'}</div>
                  <div className="text-xs italic">{iface.system2?.category || ''}</div>
                </div>
              </td>
              <td className="px-2 py-2 whitespace-nowrap text-xs">
                {iface.connection}
              </td>
              <td className="px-2 py-2 whitespace-nowrap text-xs">
                {iface.directional ? 'Directional' : 'Bidirectional'}
              </td>
              <td className="px-2 py-2 whitespace-nowrap text-right">
                <div className="flex gap-1 justify-end">
                  <button
                    onClick={() => openEditModal(iface)}
                    className="text-xs font-medium border rounded-sm bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-opacity-50 px-1.5 py-0.5"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteInterface(iface.id)}
                    className="text-xs font-medium border rounded-sm bg-red-500 text-white hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 focus:ring-opacity-50 px-1.5 py-0.5"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center p-2 border-b">
        <h2 className="text-lg font-bold">Interfaces</h2>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="text-xs font-medium border rounded-sm bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-opacity-50 px-2 py-1"
        >
          Add Interface
        </button>
      </div>
      
      {loading ? (
        <div className="p-4 text-center">Loading interfaces...</div>
      ) : (
        <div>
          {/* Tabs navigation */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('direct')}
              className={`px-3 py-1 text-xs font-medium border-b-2 ${
                activeTab === 'direct' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent hover:text-gray-700'
              }`}
            >
              Direct ({directInterfaces.length})
            </button>
            <button
              onClick={() => setActiveTab('children')}
              className={`px-3 py-1 text-xs font-medium border-b-2 ${
                activeTab === 'children' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent hover:text-gray-700'
              }`}
            >
              Children ({childrenInterfaces.length})
            </button>
            <button
              onClick={() => setActiveTab('grandchildren')}
              className={`px-3 py-1 text-xs font-medium border-b-2 ${
                activeTab === 'grandchildren' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent hover:text-gray-700'
              }`}
            >
              Grandchildren ({grandchildrenInterfaces.length})
            </button>
          </div>
          
          {/* Content based on active tab */}
          <div className="overflow-x-auto max-h-full">
            {activeTab === 'direct' && renderInterfaceTable(directInterfaces)}
            {activeTab === 'children' && renderInterfaceTable(childrenInterfaces)}
            {activeTab === 'grandchildren' && renderInterfaceTable(grandchildrenInterfaces)}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="p-4 rounded-md w-full max-w-md shadow-lg modal-content">
            <h3 className="text-lg font-bold mb-4">Add New Interface</h3>
            <form onSubmit={handleAddInterface}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">From System</label>
                <select
                  name="system1_id"
                  value={formData.system1_id}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded text-sm"
                  required
                >
                  <option value="">Select a system</option>
                  {getAvailableSystems().map(system => (
                    <option key={`from-${system.id}`} value={system.id}>
                      {system.name} {system.category ? `(${system.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">To System</label>
                <select
                  name="system2_id"
                  value={formData.system2_id}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded text-sm"
                  required
                >
                  <option value="">Select a system</option>
                  {getAvailableSystems().map(system => (
                    <option key={`to-${system.id}`} value={system.id}>
                      {system.name} {system.category ? `(${system.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Connection Description</label>
                <input
                  type="text"
                  name="connection"
                  value={formData.connection}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded text-sm"
                  required
                  placeholder="e.g., HTTP, REST API, USB, etc."
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Connection Type</label>
                <select
                  name="directional"
                  value={formData.directional.toString()}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded text-sm"
                  required
                >
                  <option value="0">Bidirectional</option>
                  <option value="1">Directional (one-way)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ system1_id: '', system2_id: '', connection: '', directional: 0 });
                    setIsAddModalOpen(false);
                  }}
                  className="px-3 py-1.5 border rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm"
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
          <div className="p-4 rounded-md w-full max-w-md shadow-lg modal-content">
            <h3 className="text-lg font-bold mb-4">Edit Interface</h3>
            <form onSubmit={handleEditInterface}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">From System</label>
                <select
                  name="system1_id"
                  value={formData.system1_id}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded text-sm"
                  required
                >
                  <option value="">Select a system</option>
                  {getAvailableSystems().map(system => (
                    <option key={`edit-from-${system.id}`} value={system.id}>
                      {system.name} {system.category ? `(${system.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">To System</label>
                <select
                  name="system2_id"
                  value={formData.system2_id}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded text-sm"
                  required
                >
                  <option value="">Select a system</option>
                  {getAvailableSystems().map(system => (
                    <option key={`edit-to-${system.id}`} value={system.id}>
                      {system.name} {system.category ? `(${system.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Connection Description</label>
                <input
                  type="text"
                  name="connection"
                  value={formData.connection}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded text-sm"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Connection Type</label>
                <select
                  name="directional"
                  value={formData.directional.toString()}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded text-sm"
                  required
                >
                  <option value="0">Bidirectional</option>
                  <option value="1">Directional (one-way)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentInterface(null);
                    setFormData({ system1_id: '', system2_id: '', connection: '', directional: 0 });
                    setIsEditModalOpen(false);
                  }}
                  className="px-3 py-1.5 border rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm"
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