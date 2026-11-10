import tubeTV from '../../assets/frames/tube-tv.svg';
import cameraFilm from '../../assets/frames/camera-film.svg';
import cameraHeader from '../../assets/frames/camera-header.svg';
import vinylInstant from '../../assets/frames/vinyl-instant.svg';
import loveScrapbook from '../../assets/frames/love-scrapbook.svg';
import retroZine from '../../assets/frames/retro-zine.svg';

export const frameLibrary = {
  Illustrated: [
    {
      name: 'Tube TV', bg: '#e5d1ad', ink: '#4a3023', caption: 'NOW ON AIR',
      artwork: tubeTV, window: [30, 34, 262, 211, 32],
    },
    {
      name: 'Camera Film', bg: '#241f20', ink: '#f7e6c2', caption: 'THE 35 MM ROLL',
      artwork: cameraFilm, header: cameraHeader, window: [52, 13, 296, 274, 0],
    },
    {
      name: 'Vinyl Instant', bg: '#e5d9c8', ink: '#4d3940', caption: 'ON REPEAT',
      artwork: vinylInstant, window: [104, 34, 223, 211, 0], tilt: 4,
    },
    {
      name: 'Love Scrapbook', bg: '#8a2035', ink: '#fff0d3', caption: 'SEALED WITH LOVE',
      artwork: loveScrapbook, window: [29, 25, 342, 244, 0],
    },
    {
      name: 'Retro Zine', bg: '#9d2e20', ink: '#ffebbf', caption: 'THE GOOD OLD DAYS',
      artwork: retroZine, window: [47, 20, 306, 256, 0],
    },
  ],
  Templates: [
    { name: 'Studio', bg: '#fffdf8', ink: '#292630', caption: 'THE PHOTO BOOTH', radius: 0 },
    {
      name: 'Analog Film', bg: '#24212b', ink: '#f7f1e8', caption: 'ANALOG · 35 MM', radius: 0,
      bgImage: 'radial-gradient(circle at 9px 9px, #fffaf0 2px, transparent 3px), radial-gradient(circle at 9px 9px, #fffaf0 2px, transparent 3px)',
      bgSize: '18px 18px', bgPos: 'left top, right top', bgRepeat: 'repeat-y',
    },
    { name: 'Soft Postcard', bg: '#f5e4d8', ink: '#672f3f', caption: 'A LITTLE KEEPSAKE', radius: 14, rule: true },
    {
      name: 'Lavender Grid', bg: '#eee8fb', ink: '#49347c', caption: 'GOOD TIMES CLUB', radius: 6, rule: true,
      bgImage: 'linear-gradient(#dcd0f4 1px, transparent 1px), linear-gradient(90deg, #dcd0f4 1px, transparent 1px)',
      bgSize: '16px 16px',
    },
    {
      name: 'Classic White', bg: '#ffffff', ink: '#242424', caption: 'PHOTO STRIP', radius: 0,
      border: '#242424', rule: true,
    },
    {
      name: 'Instant Print', bg: '#fffefa', ink: '#37332d', caption: 'IN THE MOMENT', radius: 0,
      border: '#ded7ca', footer: 28,
    },
    {
      name: 'Retro Flash', bg: '#f4d38d', ink: '#56251f', caption: 'GOOD TIMES · PHOTO BOOTH', radius: 3,
      bgImage: 'conic-gradient(#a94637 25%, transparent 0 50%, #a94637 0 75%, transparent 0)',
      bgSize: '24px 24px', rule: true,
      signaturePaper: true,
    },
    {
      name: 'Vintage Sepia', bg: '#ead6ae', ink: '#5c3b25', caption: 'FROM THE ARCHIVE', radius: 2,
      bgImage: 'linear-gradient(90deg, #b68c61, transparent 18px, transparent calc(100% - 18px), #b68c61)',
      border: '#9e7248', rule: true,
    },
    {
      name: 'Cherry Diner', bg: '#fff3e9', ink: '#78182b', caption: 'SWEET MEMORIES', radius: 8,
      bgImage: 'repeating-linear-gradient(90deg, #df75844d 0 9px, transparent 9px 18px), repeating-linear-gradient(#df75844d 0 9px, transparent 9px 18px)',
      rule: true,
      signaturePaper: true,
    },
    {
      name: '90s Arcade', bg: '#22183d', ink: '#bdfcf1', caption: 'HIGH SCORE · GOOD TIMES', radius: 6,
      bgImage: 'repeating-linear-gradient(135deg, transparent 0 12px, #61448c 12px 14px, transparent 14px 24px, #d65cbb 24px 26px)',
      border: '#8cebdc',
      signaturePaper: true,
    },
    {
      name: 'Disco Night', bg: '#1a142e', ink: '#ffdcf7', caption: 'AFTER DARK', radius: 4,
      bgImage: 'radial-gradient(circle at 5px 5px, #ffd18a 1.5px, transparent 2px), radial-gradient(circle at 15px 15px, #dc8fe8 1.5px, transparent 2px)',
      bgSize: '20px 20px',
      signaturePaper: true,
    },
    {
      name: 'Wedding Ivory', bg: '#fff7e8', ink: '#65462d', caption: 'A DAY TO REMEMBER', radius: 8,
      border: '#ad824e', rule: true,
    },
    {
      name: 'Birthday Confetti', bg: '#fff3d7', ink: '#673856', caption: 'LET’S CELEBRATE', radius: 12,
      bgImage: 'radial-gradient(circle at 5px 5px, #ee7c92 2px, transparent 2.5px), radial-gradient(circle at 15px 14px, #5aa990 2px, transparent 2.5px), radial-gradient(circle at 7px 20px, #ad83d7 2px, transparent 2.5px)',
      bgSize: '24px 24px', rule: true,
      signaturePaper: true,
    },
    {
      name: 'Holiday Evergreen', bg: '#234a3f', ink: '#ffefd0', caption: 'HAPPY HOLIDAYS', radius: 6,
      bgImage: 'repeating-linear-gradient(135deg, transparent 0 12px, #496e5c 12px 15px, transparent 15px 24px, #b77a4d 24px 26px)',
      border: '#c6a168',
      signaturePaper: true,
    },
  ],
  Colors: [
    { name: 'White', bg: '#ffffff' },
    { name: 'Black', bg: '#000000', ink: '#ffffff' },
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

export function frameBackground(frame) {
  const gradient = frame.bg.includes('gradient');
  return {
    backgroundColor: gradient ? undefined : frame.bg,
    backgroundImage: frame.bgImage ?? (gradient ? frame.bg : undefined),
    backgroundSize: frame.bgSize,
    backgroundPosition: frame.bgPos,
    backgroundRepeat: frame.bgRepeat,
  };
}
