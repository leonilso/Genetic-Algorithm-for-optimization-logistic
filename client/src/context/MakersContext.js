import React, { createContext, useState, useEffect } from 'react';

// 1. Crie o Contexto
export const MarkersContext = createContext();

export const MarkersProvider = ({ children }) => {
  const [markers, setMarkers] = useState([]);

  const contextValue = {
    markers,
    setMarkers,
  };

  return (
    <MarkersContext.Provider value={contextValue}>
      {children}
    </MarkersContext.Provider>
  );
};