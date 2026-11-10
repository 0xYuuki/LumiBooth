export const motionSeconds = 5;
export const motionDuration = motionSeconds * 1000;
export const motionFrameInterval = 125;
const motionMaxFrames = motionDuration / motionFrameInterval;
export const motionMaxEdge = 320;

export function createMotionBuffer() {
  let frames = [];
  let startedAt;

  const clear = () => {
    frames = [];
    startedAt = undefined;
  };

  return {
    add(frame) {
      const previous = frames.at(-1);
      if (previous && (previous.width !== frame.width || previous.height !== frame.height)) {
        clear();
      }
      startedAt ??= frame.time;
      frames = frames.filter((item) => frame.time - item.time < motionDuration);
      if (frames.length === motionMaxFrames) frames.shift();
      frames.push(frame);
    },

    remaining(time) {
      return Math.max(0, motionDuration - (time - (startedAt ?? time)));
    },

    take(shutterTime) {
      const captured = frames.filter(({ time }) => time < shutterTime && shutterTime - time <= motionDuration);
      clear();

      const first = captured[0]?.time ?? shutterTime;
      const last = captured.at(-1)?.time ?? shutterTime;
      const windowStart = shutterTime - motionDuration;
      // Hold the edge frames across ordinary camera and sampler jitter.
      const full = first - windowStart <= 2 * motionFrameInterval &&
        shutterTime - last <= 2 * motionFrameInterval;
      return {
        frames: captured,
        start: full ? windowStart : first,
        end: full ? shutterTime : Math.min(shutterTime, last + motionFrameInterval),
      };
    },

    clear,
  };
}
