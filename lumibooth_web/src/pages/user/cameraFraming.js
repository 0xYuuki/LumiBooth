const frameWidth = 4;
const frameHeight = 3;
export const cameraAspectRatio = frameWidth / frameHeight;

export function drawCameraFrame(video, context, maxWidth) {
  if (!video || video.readyState < 2) return false;
  const { videoWidth, videoHeight } = video;
  const cropWidth = Math.min(videoWidth, videoHeight * cameraAspectRatio);
  const cropHeight = Math.min(videoHeight, videoWidth / cameraAspectRatio);
  const units = Math.floor(Math.min(cropWidth, maxWidth) / frameWidth);
  if (!units) return false;

  const width = units * frameWidth;
  const height = units * frameHeight;
  if (context.canvas.width !== width) context.canvas.width = width;
  if (context.canvas.height !== height) context.canvas.height = height;
  context.drawImage(
    video,
    (videoWidth - cropWidth) / 2,
    (videoHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
    0,
    0,
    width,
    height,
  );
  return true;
}
