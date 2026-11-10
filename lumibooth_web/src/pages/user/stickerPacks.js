import catalog from '../../assets/stickerCatalog.json';

const emojis = ['✨', '💖', '🎀', '🧸', '🌸', '🍒', '🦋', '👑', '🎂', '🎉', '🌟', '🐾', '☁️', '🍓', '🍑', '🍭', '🧊', '💋', '💅', '🧚‍♀️', '🦄', '🌈', '🔥', '❤️‍🔥'];

export const stickerPacks = [
  { id: 'emoji', name: 'Emoji', items: emojis.map((emoji) => ({ name: emoji, emoji })) },
  ...catalog.map(({ id, name, width: atlasWidth, height: atlasHeight, items }) => ({
    id,
    name,
    items: items.map((item) => ({
      ...item,
      atlasWidth,
      atlasHeight,
      url: `${import.meta.env.BASE_URL}stickers/${id}.webp`,
    })),
  })),
];
