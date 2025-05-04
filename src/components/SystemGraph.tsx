'use client';

import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  ConnectionMode,
  Panel,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase, createInterfaceWithTransaction } from '@/lib/supabase';


interface SystemGraphProps {
  systemId: string;
  onSystemSelect?: (id: string, name: string) => void;
}

interface System {
  id: string;
  name: string;
  category: string;
  parent_id?: string | null;
}

interface Interface {
  id: string;
  system1_id: string;
  system2_id: string;
  connection: string;
  directional: number;
}

export default function SystemGraph({ systemId, onSystemSelect }: SystemGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<{ label: string; category: string; type: string }>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [currentSystem, setCurrentSystem] = useState<System | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the current system, its children, and grandchildren
  const fetchSystemData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch current system
      const { data: systemData, error: systemError } = await supabase
        .from('systems')
        .select('*')
        .eq('id', systemId)
        .single();
        
      if (systemError) {
        console.error('Error fetching system:', systemError);
        return;
      }
      
      setCurrentSystem(systemData);
      
      // Fetch direct children (subsystems)
      const { data: childSystems, error: childrenError } = await supabase
        .from('systems')
        .select('*')
        .eq('parent_id', systemId);
        
      if (childrenError) {
        console.error('Error fetching children:', childrenError);
        return;
      }
      
      // Prepare to fetch grandchildren for each child
      let allGrandchildren: System[] = [];
      
      // Fetch grandchildren for each child
      for (const child of childSystems) {
        const { data: grandchildren, error: grandchildrenError } = await supabase
          .from('systems')
          .select('*')
          .eq('parent_id', child.id);
          
        if (grandchildrenError) {
          console.error(`Error fetching grandchildren for ${child.id}:`, grandchildrenError);
          continue;
        }
        
        if (grandchildren && grandchildren.length > 0) {
          allGrandchildren = [...allGrandchildren, ...grandchildren];
        }
      }
      
      // Fetch interfaces between all systems (current, children, and grandchildren)
      const allSystemIds = [
        systemId, 
        ...childSystems.map(s => s.id),
        ...allGrandchildren.map(s => s.id)
      ];
      
      const { data: interfaces, error: interfacesError } = await supabase
        .from('interfaces')
        .select('*')
        .or(`system1_id.in.(${allSystemIds.join(',')}),system2_id.in.(${allSystemIds.join(',')})`);
        
      if (interfacesError) {
        console.error('Error fetching interfaces:', interfacesError);
      }
      
      // Create nodes and edges
      const systemNodes: Node<{ label: string; category: string; type: string; }>[] = [];
      const systemEdges: Edge[] = [];
      
      // Create center node for current system
      systemNodes.push({
        id: systemId,
        data: { 
          label: systemData.name,
          category: systemData.category,
          type: 'current'
        },
        position: { x: 250, y: 250 },
        style: {
          background: '#3ECF8E',
          color: 'white',
          border: '1px solid #107969',
          borderRadius: '8px',
          padding: '10px',
          width: 180,
        },
      } as Node<{ label: string; category: string; type: string; }>);
      
      // Create nodes for child systems with positions in a circle around the center
      const childRadius = 200;
      const childAngleStep = (2 * Math.PI) / Math.max(childSystems.length, 1);
      
      childSystems.forEach((system, index) => {
        const angle = index * childAngleStep;
        const x = 250 + childRadius * Math.cos(angle);
        const y = 250 + childRadius * Math.sin(angle);
        
        systemNodes.push({
          id: system.id,
          data: { 
            label: system.name,
            category: system.category,
            type: 'child'
          },
          position: { x, y },
          style: {
            background: '#0070f3',
            color: 'white',
            border: '1px solid #0050a3',
            borderRadius: '8px',
            padding: '10px',
            width: 150,
          },
        });
        
        // Add edge from center to this child
        systemEdges.push({
          id: `e-center-${system.id}`,
          source: systemId,
          target: system.id,
          style: { stroke: '#999', strokeWidth: 2 },
        });
      });
      
      // Create nodes for grandchildren systems
      // Position them in small circles around their parent nodes
      allGrandchildren.forEach((system) => {
        // Find parent (which child this grandchild belongs to)
        const parentIndex = childSystems.findIndex(child => child.id === system.parent_id);
        
        if (parentIndex !== -1) {
          const parentSystem = childSystems[parentIndex];
          const parentNode = systemNodes.find(node => node.id === parentSystem.id);
          
          if (parentNode) {
            // Get count of grandchildren for this parent to calculate positioning
            const siblingCount = allGrandchildren.filter(g => g.parent_id === parentSystem.id).length;
            const siblingIndex = allGrandchildren.filter(g => g.parent_id === parentSystem.id).findIndex(g => g.id === system.id);
            
            // Calculate position in a smaller circle around the parent
            const grandchildRadius = 100;
            const grandchildAngleStep = (2 * Math.PI) / Math.max(siblingCount, 1);
            const angle = siblingIndex * grandchildAngleStep;
            
            // Position relative to parent node
            const x = parentNode.position.x + grandchildRadius * Math.cos(angle);
            const y = parentNode.position.y + grandchildRadius * Math.sin(angle);
            
            systemNodes.push({
              id: system.id,
              data: { 
                label: system.name,
                category: system.category,
                type: 'grandchild'
              },
              position: { x, y },
              style: {
                background: '#6b21a8',
                color: 'white',
                border: '1px solid #4a1072',
                borderRadius: '8px',
                padding: '10px',
                width: 130,
                fontSize: '0.9em',
              },
            });
            
            // Add edge from parent to this grandchild
            systemEdges.push({
              id: `e-parent-${system.id}`,
              source: parentSystem.id,
              target: system.id,
              style: { stroke: '#6b21a8', strokeWidth: 1, strokeDasharray: '5,5' },
            });
          }
        }
      });
      
      // Add edges for interfaces
      if (interfaces) {
        interfaces.forEach((iface) => {
          // Only add interface edges if both systems are in our node list
          if (systemNodes.some(node => node.id === iface.system1_id) && 
              systemNodes.some(node => node.id === iface.system2_id)) {
            systemEdges.push({
              id: `e-${iface.id}`,
              source: iface.system1_id,
              target: iface.system2_id,
              animated: true,
              label: iface.connection,
              labelStyle: { fill: '#333', fontSize: 10 },
              style: { 
                stroke: '#333', 
                strokeWidth: iface.directional ? 3 : 2,
                strokeDasharray: iface.directional ? undefined : '3,3'
              },
            });
          }
        });
      }
      
      setNodes(systemNodes);
      setEdges(systemEdges);
    } catch (error) {
      console.error('Error in fetchSystemData:', error);
    } finally {
      setLoading(false);
    }
  }, [systemId, setNodes, setEdges]);

  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData]);

  // Handle connections between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      console.debug('Connection created between nodes', params);
      
      // Create a new interface in the database when a connection is made
      const createInterface = async () => {
        try {
          const newInterfaceId = await createInterfaceWithTransaction(
            params.source as string,
            params.target as string,
            'New Connection', // Default connection name
            0 // Default to bidirectional
          );
          
          console.debug('Interface created successfully', { newInterfaceId });
          
          // Reload graph after creating the interface
          fetchSystemData();
        } catch (error) {
          console.error('Error in createInterface:', error);
        }
      };
      
      // If a connection is made in the UI, create the interface
      createInterface();
      
      // Also update the local state for immediate feedback
      setEdges((eds) => addEdge({
        ...params,
        animated: true,
        style: { stroke: '#333', strokeWidth: 2, strokeDasharray: '3,3' },
      }, eds));
    },
    [setEdges, fetchSystemData]
  );

  // Handle node click - navigate to the selected subsystem
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node<{ label: string; category: string; type: string }>) => {
      if (node.id !== systemId && onSystemSelect) {
        onSystemSelect(node.id, node.data.label);
      }
    },
    [systemId, onSystemSelect]
  );

  // Generate a legend for the graph
  const renderLegend = () => {
    return (
      <div className="bg-white p-2 rounded shadow-md text-xs">
        <h4 className="font-bold mb-1">Legend:</h4>
        <div className="flex items-center mb-1">
          <div className="w-3 h-3 bg-[#3ECF8E] mr-1 rounded-sm"></div>
          <span>Current System</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-3 h-3 bg-[#0070f3] mr-1 rounded-sm"></div>
          <span>Child Systems</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-3 h-3 bg-[#6b21a8] mr-1 rounded-sm"></div>
          <span>Grandchild Systems</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full">Loading system graph...</div>;
  }

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <div className="p-3 border-b">
        <h2 className="text-xl font-bold">{currentSystem?.name || 'System Graph'}</h2>
        <p className="text-sm italic">{currentSystem?.category || ''}</p>
      </div>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        
        <Panel position="top-right" className="mr-12 mt-12">
          {renderLegend()}
        </Panel>
      </ReactFlow>
    </div>
  );
}