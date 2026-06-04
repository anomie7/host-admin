import React, { createContext, useContext, useState, useCallback } from 'react';

const SidePanelContext = createContext();

export function useSidePanel() {
  return useContext(SidePanelContext);
}

export function SidePanelProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <SidePanelContext.Provider value={{ isOpen, activeTab, setActiveTab, toggle, open, close }}>
      {children}
    </SidePanelContext.Provider>
  );
}
