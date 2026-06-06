import React, { createContext, useContext, useState, useCallback } from 'react';

const SidePanelContext = createContext();

export function useSidePanel() {
  return useContext(SidePanelContext);
}

export function SidePanelProvider({ children }) {
  const [isOpen, setIsOpen] = useState(true); // 기본 활성화

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <SidePanelContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </SidePanelContext.Provider>
  );
}
