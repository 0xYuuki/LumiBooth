import { useLayoutEffect, useRef, useState } from 'react';
import { PhotoStrip } from '../pages/user/PhotoStrip';

export default function MotionStrip({ session, imageSize, motionUrls }) {
  const container = useRef(null);
  const [width, setWidth] = useState(null);
  const designWidth = imageSize.width / 3;

  useLayoutEffect(() => {
    const element = container.current;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={container} className="motion-strip" role="group" aria-label="Animated LumiBooth photo strip">
      {width > 0 && (
        <div style={{ width: designWidth, transform: `scale(${width / designWidth})` }}>
          <PhotoStrip session={session} motionUrls={motionUrls} />
        </div>
      )}
    </div>
  );
}
