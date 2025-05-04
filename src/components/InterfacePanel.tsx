'use client';
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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
  const [interfaces, setInterfaces] = useState<Interface[]>([]);
  const [loading, setLoading] = useState(true);
  const [directChildren, setDirectChildren] = useState<System[]>([]);
  const [grandchildren, setGrandchildren] = useState<System[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentInterface, setCurrentInterface] = useState<Interface | null>(null);
  const [formData, setFormData] = useState({
    system1_id: '',
    system2_id: '',
    connection: '',
    directional: 0
  });

  // Fetch direct children and grandchildren
  const fetchDescendants = useCallback(async () => {
    try {
      // Fetch direct children
      const { data: children, error: childrenError } = await supabase
        .from('systems')
        .select('*')
        .eq('parent_id', systemId);

      if (childrenError) {
        console.error('Error fetching children:', childrenError);
        return;
      }

      // Add depth information 
      const childrenWithDepth = children.map(child => ({
        ...child,
        depth: 1
      }));
      
      setDirectChildren(childrenWithDepth);

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
      
      return [...childrenWithDepth, ...allGrandchildren];
    } catch (error) {
      console.error('Unexpected error:', error);
      return [];
    }
  }, [systemId]);

  // Fetch all interfaces related to the current system and its descendants
  const fetchInterfaces = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get all descendant systems
      const descendants = await fetchDescendants();
      
      // Get all relevant system IDs (current + descendants)
      const allSystemIds = [systemId, ...(descendants || []).map(s => s.id)];
      
      // Fetch interfaces where system1 or system2 is in our list
      const { data: interfacesData, error: interfacesError } = await supabase
        .from('interfaces')
        .select('*')
        .or(`system1_id.in.(${allSystemIds.join(',')}),system2_id.in.(${allSystemIds.join(',')})`);
        
      if (interfacesError) {
        console.error('Error fetching interfaces:', interfacesError);
        return;
      }
      
      // For each interface, fetch the connected systems' details
      const enrichedInterfaces = await Promise.all(
        interfacesData.map(async (iface) => {
          const { data: system1Data } = await supabase
            .from('systems')
            .select('*')
            .eq('id', iface.system1_id)
            .single();
            
          const { data: system2Data } = await supabase
            .from('systems')
            .select('*')
            .eq('id', iface.system2_id)
            .single();
            
          return {
            ...iface,
            system1: system1Data,
            system2: system2Data
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
      const newInterface = {
        system1_id: formData.system1_id,
        system2_id: formData.system2_id,
        connection: formData.connection,
        directional: formData.directional
      };

      const { data, error } = await supabase
        .from('interfaces')
        .insert([newInterface])
        .select();

      if (error) {
        console.error('Error adding interface:', error);
      } else {
        // Reset form and close modal
        setFormData({ system1_id: '', system2_id: '', connection: '', directional: 0 });
        setIsAddModalOpen(false);
        // Fetch updated list
        fetchInterfaces();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  // Edit interface
  const handleEditInterface = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInterface) return;

    try {
      const { data, error } = await supabase
        .from('interfaces')
        .update({
          system1_id: formData.system1_id,
          system2_id: formData.system2_id,
          connection: formData.connection,
          directional: formData.directional
        })
        .eq('id', currentInterface.id)
        .select();

      if (error) {
        console.error('Error updating interface:', error);
      } else {
        // Reset form and close modal
        setCurrentInterface(null);
        setFormData({ system1_id: '', system2_id: '', connection: '', directional: 0 });
        setIsEditModalOpen(false);
        // Fetch updated list
        fetchInterfaces();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  // Delete interface
  const handleDeleteInterface = async (id: string) => {
    if (confirm('Are you sure you want to delete this interface?')) {
      try {
        const { error } = await supabase
          .from('interfaces')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting interface:', error);
        } else {
          // Fetch updated list
          fetchInterfaces();
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      }
    }
  };

  // Open edit modal with interface data
  const openEditModal = (iface: Interface) => {
    setCurrentInterface(iface);
    setFormData({
      system1_id: iface.system1_id,
      system2_id: iface.system2_id,
      connection: iface.connection,
      directional: iface.directional
    });
    setIsEditModalOpen(true);
  };

  // Get current system details for dropdowns
  const fetchCurrentSystem = useCallback(async () => {
    const { data, error } = await supabase
      .from('systems')
      .select('*')
      .eq('id', systemId)
      .single();
      
    if (error) {
      console.error('Error fetching current system:', error);
      return null;
    }
    
    return data;
  }, [systemId]);

  // Get all available systems for dropdowns (current + descendants + connected external systems)
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

  return (
    <div className="w-full mt-4 border rounded-lg p-3">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold">Interfaces</h2>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="text-md font-bold border rounded-sm bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 px-2 py-1"
        >
          Add Interface
        </button>
      </div>
      
      {loading ? (
        <div className="p-4 text-center">Loading interfaces...</div>
      ) : interfaces.length === 0 ? (
        <div className="p-4 text-center">No interfaces found</div>
      ) : (
        <div className="overflow-x-auto">
          {/* Direct interfaces section */}
          {directInterfaces.length > 0 && (
            <>
              <h3 className="text-md font-bold mt-3 mb-2">Direct Interfaces</h3>
              <table className="min-w-full divide-y divide-gray-200 mb-6">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From System</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To System</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connection</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {directInterfaces.map((iface) => (
                    <tr key={iface.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{iface.system1?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{iface.system1?.category || ''}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{iface.system2?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{iface.system2?.category || ''}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {iface.connection}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {iface.directional ? 'Directional' : 'Bidirectional'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(iface)}
                            className="text-sm font-bold border rounded-sm bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 px-2 py-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteInterface(iface.id)}
                            className="text-sm font-bold border rounded-sm bg-red-500 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 px-2 py-1"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          
          {/* Children interfaces section */}
          {childrenInterfaces.length > 0 && (
            <>
              <h3 className="text-md font-bold mt-3 mb-2">Child System Interfaces</h3>
              <table className="min-w-full divide-y divide-gray-200 mb-6">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From System</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To System</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connection</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {childrenInterfaces.map((iface) => (
                    <tr key={iface.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{iface.system1?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{iface.system1?.category || ''}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{iface.system2?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{iface.system2?.category || ''}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {iface.connection}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {iface.directional ? 'Directional' : 'Bidirectional'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(iface)}
                            className="text-sm font-bold border rounded-sm bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 px-2 py-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteInterface(iface.id)}
                            className="text-sm font-bold border rounded-sm bg-red-500 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 px-2 py-1"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          
          {/* Grandchildren interfaces section */}
          {grandchildrenInterfaces.length > 0 && (
            <>
              <h3 className="text-md font-bold mt-3 mb-2">Grandchild System Interfaces</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From System</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To System</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connection</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {grandchildrenInterfaces.map((iface) => (
                    <tr key={iface.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{iface.system1?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{iface.system1?.category || ''}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{iface.system2?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{iface.system2?.category || ''}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {iface.connection}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {iface.directional ? 'Directional' : 'Bidirectional'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(iface)}
                            className="text-sm font-bold border rounded-sm bg-blue-500 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 px-2 py-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteInterface(iface.id)}
                            className="text-sm font-bold border rounded-sm bg-red-500 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 px-2 py-1"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-md w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add New Interface</h3>
            <form onSubmit={handleAddInterface}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">From System</label>
                <select
                  name="system1_id"
                  value={formData.system1_id}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
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
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">To System</label>
                <select
                  name="system2_id"
                  value={formData.system2_id}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
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
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Connection Description</label>
                <input
                  type="text"
                  name="connection"
                  value={formData.connection}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                  placeholder="e.g., HTTP, REST API, USB, etc."
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Connection Type</label>
                <select
                  name="directional"
                  value={formData.directional.toString()}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
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
            <h3 className="text-lg font-bold mb-4">Edit Interface</h3>
            <form onSubmit={handleEditInterface}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">From System</label>
                <select
                  name="system1_id"
                  value={formData.system1_id}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
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
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">To System</label>
                <select
                  name="system2_id"
                  value={formData.system2_id}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
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
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Connection Description</label>
                <input
                  type="text"
                  name="connection"
                  value={formData.connection}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Connection Type</label>
                <select
                  name="directional"
                  value={formData.directional.toString()}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
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