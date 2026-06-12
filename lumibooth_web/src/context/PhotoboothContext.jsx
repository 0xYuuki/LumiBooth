import React, { createContext, useState } from 'react';

export const PhotoboothContext = createContext();

export const PhotoboothProvider = ({ children }) => {
  const [layout, setLayout] = useState({ id: '4-grid', count: 4 });
  const [photos, setPhotos] = useState([]);

  return (
    <PhotoboothContext.Provider value={{ layout, setLayout, photos, setPhotos }}>
      {children}
    </PhotoboothContext.Provider>
  );
};
