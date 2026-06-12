import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const WebWelcome = () => {
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate('/layout')}
      style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#FCFBFA', // Clean off-white
        color: '#2A2A2A', // Charcoal text
        cursor: 'pointer',
        fontFamily: '"Outfit", sans-serif',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <h1 style={{ 
          fontSize: '3.5rem', 
          fontWeight: '300', 
          margin: '0',
          letterSpacing: '14px',
          textTransform: 'uppercase',
          marginLeft: '14px' // Optical alignment for wide letter spacing
        }}>
          LumiBooth
        </h1>
        <p style={{ 
          margin: '0', 
          fontSize: '0.9rem',
          letterSpacing: '6px',
          textTransform: 'lowercase',
          fontWeight: '300',
          opacity: 0.5,
          marginLeft: '6px'
        }}>
          est. 2026
        </p>
      </motion.div>
      
      <motion.div
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          bottom: '15%',
          fontSize: '0.85rem',
          letterSpacing: '4px',
          fontWeight: '300',
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(42, 42, 42, 0.3)',
          paddingBottom: '4px'
        }}
      >
        Touch to Start
      </motion.div>
    </div>
  );
};

export default WebWelcome;
