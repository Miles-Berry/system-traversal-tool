'use client';

import { useState } from "react";
import dynamic from "next/dynamic";

// Use dynamic import for the components
const SystemGraph = dynamic(
  () => import('@/components/SystemGraph'),
  { ssr: false }
);

const SystemDetails = dynamic(
  () => import('@/components/SystemDetails'),
  { ssr: false }
);

const InterfacePanel = dynamic(
  () => import('@/components/InterfacePanel'),
  { ssr: false }
);

// Simple breadcrumb component
interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbsProps {
  path: BreadcrumbItem[];
  onNavigate: (id: string) => void;
}

const Breadcrumbs = ({ path, onNavigate }: BreadcrumbsProps) => {
  return (
    <div className="flex items-center mb-2 text-sm overflow-x-auto whitespace-nowrap py-1">
      {path.map((item, index) => (
        <div key={item.id} className="flex items-center">
          {index > 0 && <span className="mx-1 text-gray-400">/</span>}
          <button 
            onClick={() => onNavigate(item.id)}
            className="hover:underline text-blue-500 px-1"
          >
            {item.name}
          </button>
        </div>
      ))}
    </div>
  );
};

export default function Home() {
  console.debug('Rendering Home component');
  
  // State for current system and navigation path
  const [currentSystemId, setCurrentSystemId] = useState("00000000-0000-0000-0000-000000000001");
  const [navigationPath, setNavigationPath] = useState([
    { id: "00000000-0000-0000-0000-000000000001", name: "Root System" }
  ]);

  // Handle system selection
  interface SystemSelectHandler {
    (systemId: string, systemName: string): void;
  }

  const handleSystemSelect: SystemSelectHandler = (systemId, systemName) => {
    console.debug('System selected', { systemId, systemName });
    setCurrentSystemId(systemId);
    
    // Check if we're navigating to a system already in the path
    const existingIndex = navigationPath.findIndex(item => item.id === systemId);
    
    if (existingIndex >= 0) {
      // If we're navigating to a system in our path, trim the path
      setNavigationPath(navigationPath.slice(0, existingIndex + 1));
    } else {
      // Add the new system to the path
      setNavigationPath([...navigationPath, { id: systemId, name: systemName }]);
    }
  };

  // Navigate using breadcrumbs
  interface BreadcrumbNavigateHandler {
    (systemId: string): void;
  }

  const handleBreadcrumbNavigate: BreadcrumbNavigateHandler = (systemId) => {
    console.debug('Breadcrumb navigation', { systemId });
    const existingIndex = navigationPath.findIndex(item => item.id === systemId);
    if (existingIndex >= 0) {
      setCurrentSystemId(systemId);
      setNavigationPath(navigationPath.slice(0, existingIndex + 1));
    }
  };

  return (
    <div className="container mx-auto p-2 max-w-7xl">
      <h1 className="text-xl font-bold">System Navigator</h1>
      
      {/* Breadcrumb navigation */}
      <Breadcrumbs 
        path={navigationPath} 
        onNavigate={handleBreadcrumbNavigate} 
      />
      
      <div className="flex flex-col md:flex-row gap-3">
        {/* Left column - Graph view */}
        <div className="md:w-1/2 border rounded-lg overflow-hidden shadow-sm h-[730px]">
          <SystemGraph 
            systemId={currentSystemId} 
            onSystemSelect={handleSystemSelect} 
          />
        </div>
        
        {/* Right column - Details and interfaces */}
        <div className="md:w-1/2 flex flex-col space-y-3">
          {/* System details section */}
          <div className="border rounded-lg overflow-hidden shadow-sm h-1/2">
            <SystemDetails 
              systemId={currentSystemId} 
              onSystemSelect={handleSystemSelect}
            />
          </div>
          
          {/* Interface panel section */}
          <div className="border rounded-lg overflow-hidden shadow-sm h-1/2">
            <InterfacePanel 
              systemId={currentSystemId} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}