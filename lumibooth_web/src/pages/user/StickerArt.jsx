export default function StickerArt({ art }) {
  if (!art.url) return <span aria-hidden="true">{art.emoji}</span>;

  const { x, y, width, height, atlasWidth, atlasHeight, url } = art;
  const longestSide = Math.max(width, height);
  return (
    <span aria-hidden="true" className="sticker-art" style={{
      width: `${width / longestSide * 100}%`,
      height: `${height / longestSide * 100}%`,
      backgroundImage: `url("${url}")`,
      backgroundSize: `${atlasWidth / width * 100}% ${atlasHeight / height * 100}%`,
      backgroundPosition: `${x / (atlasWidth - width) * 100}% ${y / (atlasHeight - height) * 100}%`,
    }} />
  );
}
