import { useEffect, useState } from 'react';
import { drawCameraFrame } from '../pages/user/cameraFraming';
import { createMotionBuffer, motionFrameInterval, motionMaxEdge } from './motionBuffer';

export function useMotionCapture(webcamRef, enabled) {
  const [buffer] = useState(createMotionBuffer);

  useEffect(() => {
    if (!enabled) return;
    const video = webcamRef.current?.video;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!video || !context) return;

    let lastVideoTime;
    const clear = () => {
      buffer.clear();
      lastVideoTime = undefined;
    };
    const interval = setInterval(() => {
      if (document.hidden || video.currentTime === lastVideoTime) return;
      const time = performance.now();
      try {
        if (!drawCameraFrame(video, context, motionMaxEdge)) return;
        const { width, height } = canvas;
        const { data } = context.getImageData(0, 0, width, height);
        buffer.add({ width, height, time, data: data.buffer });
        lastVideoTime = video.currentTime;
      } catch {
        clear();
      }
    }, motionFrameInterval);
    video.addEventListener('resize', clear);
    document.addEventListener('visibilitychange', clear);
    window.addEventListener('pagehide', clear);
    return () => {
      clearInterval(interval);
      video.removeEventListener('resize', clear);
      document.removeEventListener('visibilitychange', clear);
      window.removeEventListener('pagehide', clear);
      clear();
    };
  }, [buffer, enabled, webcamRef]);

  return buffer;
}
