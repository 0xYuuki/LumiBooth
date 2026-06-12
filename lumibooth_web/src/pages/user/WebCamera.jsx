import React, { useRef, useCallback, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { PhotoboothContext } from '../../context/PhotoboothContext';

const WebCamera = () => {
  const webcamRef = useRef(null);
  const navigate = useNavigate();
  const { layout, photos, setPhotos } = useContext(PhotoboothContext);
  
  const [timer, setTimer] = useState(0);
  const [isCounting, setIsCounting] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    const newPhotos = [...photos, imageSrc];
    setPhotos(newPhotos);
    
    if (newPhotos.length >= layout.count) {
      navigate('/editor');
    }
  }, [webcamRef, photos, layout.count, navigate, setPhotos]);

  useEffect(() => {
    let interval;
    if (isCounting && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else if (isCounting && countdown === 0) {
      capture();
      setIsCounting(false);
    }
    return () => clearInterval(interval);
  }, [isCounting, countdown, capture]);

  const handleCaptureClick = () => {
    if (timer > 0) {
      setCountdown(timer);
      setIsCounting(true);
    } else {
      capture();
    }
  };

  const toggleTimer = () => {
    if (isCounting) return;
    if (timer === 0) setTimer(3);
    else if (timer === 3) setTimer(5);
    else if (timer === 5) setTimer(10);
    else setTimer(0);
  };

  return (
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '5px 15px', borderRadius: '20px', color: 'white', fontWeight: 'bold' }}>
          {photos.length} / {layout.count}
        </div>
        <div style={{ width: '24px' }}></div>
      </div>

      {/* Camera View */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          maxWidth: '800px', 
          aspectRatio: '4/3', 
          borderRadius: '20px', 
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          backgroundColor: '#222'
        }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "user" }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {isCounting && countdown > 0 && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '120px', fontWeight: 'bold', textShadow: '0 4px 10px rgba(0,0,0,0.5)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
              {countdown}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{ padding: '30px', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <button onClick={toggleTimer} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '24px' }}>⏱️</span>
          {timer > 0 && <span style={{ marginTop: '5px', fontWeight: 'bold' }}>{timer}s</span>}
        </button>
        
        <button 
          onClick={handleCaptureClick}
          disabled={isCounting}
          style={{ 
            width: 80, height: 80, borderRadius: '50%', 
            border: '4px solid white', background: isCounting ? 'red' : 'transparent',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            cursor: isCounting ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'white' }}></div>
        </button>
        
        <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
          <span style={{ fontSize: '24px' }}>🔄</span>
        </button>
      </div>
    </div>
  );
};

export default WebCamera;
