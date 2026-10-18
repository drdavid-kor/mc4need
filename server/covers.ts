// Only browser-normalized, static WebP is accepted. No SVG, EXIF or animation.
export function validCover(bytes: Uint8Array) {
  const text = (at: number, len: number) =>
    new TextDecoder().decode(bytes.slice(at, at + len));
  if (
    bytes.length < 30 ||
    bytes.length > 400000 ||
    text(0, 4) !== "RIFF" ||
    text(8, 4) !== "WEBP"
  )
    return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) return false;
  let image = false;
  for (let pos = 12; pos + 8 <= bytes.length;) {
    const tag = text(pos, 4),
      size = view.getUint32(pos + 4, true);
    if (
      pos + 8 + size > bytes.length ||
      !["VP8 ", "VP8L", "VP8X", "ALPH"].includes(tag)
    )
      return false;
    if (
      tag === "VP8X" &&
      (size !== 10 || (bytes[pos + 8] & 0x3e) !== (bytes[pos + 8] & 0x10))
    )
      return false;
    if (tag === "VP8 " || tag === "VP8L") image = true;
    pos += 8 + size + (size % 2);
    if (pos === bytes.length) return image;
  }
  return false;
}
