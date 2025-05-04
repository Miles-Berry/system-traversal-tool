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
import { supabase } from '@/lib/supabase';

interface SystemGraphProps {
  systemId: string;
  onSystemSelect?: (id: string, name: string) => void;
}

interface System {
  id: string;
  name: string;
  category: string;
}

interface Interface {
  id: string;
  system1_id: string;
  system2_id: string;
  connection: string;
  directional: number;
}

export default function SystemGraph({ systemId, onSystemSelect }: SystemGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<{ label: string; category: string }>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<any>>([]);
  const [currentSystem, setCurrentSystem] = useState<System | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the current system and its subsystems
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
      
      // Fetch subsystems
      const { data: subsystems, error: subsystemsError } = await supabase
        .from('systems')
        .select('*')
        .eq('parent_id', systemId);
        
      if (subsystemsError) {
        console.error('Error fetching subsystems:', subsystemsError);
        return;
      }
      
      // Fetch interfaces between subsystems
      const { data: interfaces, error: interfacesError } = await supabase
        .from('interfaces')
        .select('*')
        .in('system1_id', subsystems.map(s => s.id))
        .in('system2_id', subsystems.map(s => s.id));
        
      if (interfacesError) {
        console.error('Error fetching interfaces:', interfacesError);
      }
      
      // Create nodes and edges
      const systemNodes: Node<{ label: string; category: string }>[] = [];
      const systemEdges: Edge<any>[] = [];
      
      // Create center node for current system
      systemNodes.push({
        id: systemId,
        data: { 
          label: systemData.name,
          category: systemData.category
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
      });
      
      // Create nodes for subsystems with positions in a circle around the center
      const radius = 200;
      const angleStep = (2 * Math.PI) / subsystems.length;
      
      subsystems.forEach((system, index) => {
        const angle = index * angleStep;
        const x = 250 + radius * Math.cos(angle);
        const y = 250 + radius * Math.sin(angle);
        
        systemNodes.push({
          id: system.id,
          data: { 
            label: system.name,
            category: system.category 
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
        
        // Add edge from center to this node
        systemEdges.push({
          id: `e-center-${system.id}`,
          source: systemId,
          target: system.id,
          style: { stroke: '#999', strokeWidth: 1, strokeDasharray: '5,5' },
        });
      });
      
      // Add edges for interfaces
      if (interfaces) {
        interfaces.forEach((iface) => {
          systemEdges.push({
            id: `e-${iface.id}`,
            source: iface.system1_id,
            target: iface.system2_id,
            animated: true,
            label: iface.connection,
            style: { stroke: '#333', strokeWidth: 2 },
          });
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
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Handle node click - navigate to the selected subsystem
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node<{ label: string; category: string }>) => {
      if (node.id !== systemId && onSystemSelect) {
        onSystemSelect(node.id, node.data?.label || '');
      }
    },
    [systemId, onSystemSelect]
  );

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
      </ReactFlow>
    </div>
  );
}