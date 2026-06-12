import React, { useContext, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhotoboothContext } from '../../context/PhotoboothContext';
import { motion } from 'framer-motion';

const frameLibrary = {
  Colors: [
    { name: 'White', bg: '#ffffff' },
    { name: 'Black', bg: '#000000' },
    { name: 'Pastel Pink', bg: '#FFB6C1' },
    { name: 'Pastel Blue', bg: '#AEC6CF' },
    { name: 'Lavender', bg: '#B07DF0' },
    { name: 'Cream', bg: '#FFFACD' },
    { name: 'Mint', bg: '#98FF98' },
    { name: 'Coral', bg: '#FF7F50' },
  ],
  Gradients: [
    { name: 'Sunset', bg: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)' },
    { name: 'Candy', bg: 'linear-gradient(to top, #ff0844 0%, #ffb199 100%)' },
    { name: 'Ocean', bg: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)' },
    { name: 'Twilight', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { name: 'Peach', bg: 'linear-gradient(to right, #ffecd2 0%, #fcb69f 100%)' },
    { name: 'Minty', bg: 'linear-gradient(to right, #00b09b, #96c93d)' },
  ],
  Patterns: [
    { 
      name: 'Pink Dots', 
      bg: '#ffffff',
      bgImage: 'radial-gradient(#FFB6C1 20%, transparent 20%), radial-gradient(#FFB6C1 20%, transparent 20%)',
      bgSize: '20px 20px',
      bgPos: '0 0, 10px 10px',
    },
    {
      name: 'Blue Stripes',
      bg: 'repeating-linear-gradient(45deg, #AEC6CF, #AEC6CF 10px, #ffffff 10px, #ffffff 20px)'
    },
    {
      name: 'Grid',
      bg: '#ffffff',
      bgImage: 'linear-gradient(#e5e5e5 2px, transparent 2px), linear-gradient(90deg, #e5e5e5 2px, transparent 2px)',
      bgSize: '20px 20px',
    }
  ]
};

const stickerLibrary = ['✨', '💖', '🎀', '🧸', '🌸', '🍒', '🦋', '👑', '🎂', '🎉', '🌟', '🐾', '☁️', '🍓', '🍑', '🍭', '🧊', '💋', '💅', '🧚‍♀️', '🦄', '🌈', '🔥', '❤️‍🔥'];

const WebEditor = () => {
  const { photos, layout } = useContext(PhotoboothContext);
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('Frames'); // 'Frames' or 'Stickers'
  const [activeCategory, setActiveCategory] = useState('Colors');
  const [selectedFrame, setSelectedFrame] = useState(frameLibrary.Colors[0]);
  const [placedStickers, setPlacedStickers] = useState([]);
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  const constraintsRef = useRef(null);

  const addSticker = (emoji) => {
    const id = Date.now();
    setPlacedStickers([...placedStickers, { id, emoji, size: 50 }]);
    setSelectedStickerId(id);
    setActiveTab('Stickers');
  };

  const updateStickerSize = (id, newSize) => {
    setPlacedStickers(placedStickers.map(s => s.id === id ? { ...s, size: newSize } : s));
  };
  
  const deleteSticker = (id) => {
    setPlacedStickers(placedStickers.filter(s => s.id !== id));
    setSelectedStickerId(null);
  };

  const getGridCols = () => {
    if (layout.count === 1) return 1;
    if (layout.count > 3) return 2;
    return 1;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-light)' }}>
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', boxShadow: 'var(--shadow-sm)' }}>
        <h2 style={{ margin: 0 }}>Edit Photo Strip</h2>
        <button className="btn-primary" onClick={() => navigate('/preview')}>Next</button>
      </div>
      
      {/* Photo Strip Preview */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '30px', overflow: 'hidden' }}>
        <div 
          ref={constraintsRef}
          onPointerDown={() => setSelectedStickerId(null)}
          style={{ 
          background: selectedFrame.bg,
          backgroundImage: selectedFrame.bgImage || (selectedFrame.bg.includes('gradient') ? selectedFrame.bg : 'none'),
          backgroundSize: selectedFrame.bgSize || 'auto',
          backgroundPosition: selectedFrame.bgPos || '0 0',
          padding: '40px 40px 80px 40px', 
          boxShadow: 'var(--shadow-md)',
          display: 'grid',
          gridTemplateColumns: `repeat(${getGridCols()}, 1fr)`,
          gap: '20px',
          maxWidth: '400px',
          width: '100%',
          transition: 'all 0.3s',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {photos.map((photo, i) => (
            <img key={i} src={photo} alt={`Captured ${i}`} style={{ width: '100%', objectFit: 'cover', aspectRatio: '3/4', pointerEvents: 'none', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }} />
          ))}
          
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '0',
            right: '0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            pointerEvents: 'none',
          }}>
            <div style={{
              fontFamily: '"Outfit", sans-serif',
              fontSize: '16px',
              letterSpacing: '8px',
              fontWeight: '400',
              textTransform: 'uppercase',
              color: selectedFrame.bg === '#000000' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)',
              marginLeft: '4px' // Optical alignment for letter-spacing
            }}>
              LumiBooth
            </div>
            <div style={{
              fontFamily: '"Outfit", sans-serif',
              fontSize: '10px',
              letterSpacing: '4px',
              fontWeight: '300',
              textTransform: 'lowercase',
              color: selectedFrame.bg === '#000000' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.4)',
              marginLeft: '2px' // Optical alignment
            }}>
              est. 2026
            </div>
          </div>

          {placedStickers.map(sticker => {
            const isSelected = selectedStickerId === sticker.id;
            return (
              <motion.div
                key={sticker.id}
                drag
                dragConstraints={constraintsRef}
                dragMomentum={false}
                onPointerDown={(e) => { e.stopPropagation(); setSelectedStickerId(sticker.id); }}
                whileTap={{ scale: 1.05 }}
                style={{
                  position: 'absolute',
                  top: '40%',
                  left: '40%',
                  fontSize: `${sticker.size}px`,
                  cursor: 'grab',
                  userSelect: 'none',
                  lineHeight: 1,
                  zIndex: isSelected ? 20 : 10,
                  border: isSelected ? '2px dashed var(--primary-pink)' : '2px solid transparent',
                  padding: '5px',
                  borderRadius: '8px'
                }}
              >
                {sticker.emoji}
                {isSelected && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteSticker(sticker.id); }}
                    style={{
                      position: 'absolute', top: '-10px', right: '-10px',
                      background: 'white', color: 'red', border: '1px solid red', borderRadius: '50%',
                      width: '24px', height: '24px', fontSize: '14px', cursor: 'pointer',
                      display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold'
                    }}
                  >
                    ✕
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Tools Drawer */}
      <div style={{ background: 'white', padding: '25px', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          <button
            onClick={() => setActiveTab('Frames')}
            style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: activeTab === 'Frames' ? 'bold' : 'normal', color: activeTab === 'Frames' ? 'var(--primary-pink)' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            Frames
          </button>
          <button
            onClick={() => setActiveTab('Stickers')}
            style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: activeTab === 'Stickers' ? 'bold' : 'normal', color: activeTab === 'Stickers' ? 'var(--primary-pink)' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            Stickers
          </button>
        </div>

        {activeTab === 'Frames' && (
          <>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
              {Object.keys(frameLibrary).map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: activeCategory === category ? 'bold' : 'normal',
                    color: activeCategory === category ? 'var(--text-dark)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    borderBottom: activeCategory === category ? '2px solid var(--text-dark)' : '2px solid transparent',
                    paddingBottom: '5px'
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
              {frameLibrary[activeCategory].map(frame => {
                const isSelected = selectedFrame.name === frame.name;
                return (
                  <div key={frame.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '60px' }}>
                    <button 
                      onClick={() => setSelectedFrame(frame)}
                      style={{
                        width: '60px', height: '60px', borderRadius: '12px', flexShrink: 0,
                        background: frame.bg,
                        backgroundImage: frame.bgImage || (frame.bg.includes('gradient') ? frame.bg : 'none'),
                        backgroundSize: frame.bgSize || 'auto',
                        backgroundPosition: frame.bgPos || '0 0',
                        border: isSelected ? '3px solid var(--primary-pink)' : '1px solid #ddd',
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 4px 12px rgba(255, 182, 193, 0.4)' : 'none'
                      }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{frame.name}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'Stickers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
              {stickerLibrary.map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => addSticker(emoji)}
                  style={{
                    background: 'var(--bg-light)', border: 'none', borderRadius: '12px',
                    fontSize: '32px', width: '60px', height: '60px', flexShrink: 0,
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            
            {selectedStickerId && (
              <div style={{ padding: '15px', background: 'var(--bg-light)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Size:</span>
                <input 
                  type="range" 
                  min="20" max="150" 
                  value={placedStickers.find(s => s.id === selectedStickerId)?.size || 50}
                  onChange={(e) => updateStickerSize(selectedStickerId, parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--primary-pink)' }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebEditor;
