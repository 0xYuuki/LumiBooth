export const frameLibrary = {
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
