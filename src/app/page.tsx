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
    <div className="flex items-center mb-4 text-sm">
      {path.map((item, index) => (
        <div key={item.id} className="flex items-center">
          {index > 0 && <span className="mx-2">&gt;</span>}
          <button 
            onClick={() => onNavigate(item.id)}
            className="hover:underline text-blue-500"
          >
            {item.name}
          </button>
        </div>
      ))}
    </div>
  );
};

export default function Home() {
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
    const existingIndex = navigationPath.findIndex(item => item.id === systemId);
    if (existingIndex >= 0) {
      setCurrentSystemId(systemId);
      setNavigationPath(navigationPath.slice(0, existingIndex + 1));
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">System Navigator</h1>
      
      {/* Breadcrumb navigation */}
      <Breadcrumbs 
        path={navigationPath} 
        onNavigate={handleBreadcrumbNavigate} 
      />
      
      <div className="container flex flex-row justify-between">
        {/* Left column - Graph view */}
        <div className="border rounded-lg overflow-hidden w-[49%]">
          <SystemGraph 
            systemId={currentSystemId} 
            onSystemSelect={handleSystemSelect} 
          />
        </div>
        
        {/* Right column - Details and interfaces */}
        <div className="w-[49%] flex flex-col space-y-4">
          {/* System details section */}
          <div className="border rounded-lg overflow-hidden">
            <SystemDetails 
              systemId={currentSystemId} 
              onSystemSelect={handleSystemSelect}
            />
          </div>
          
          {/* Interface panel section */}
          <div className="border rounded-lg overflow-hidden">
            <InterfacePanel 
              systemId={currentSystemId} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}