// The painting stays in GeezSheets' existing battlemap file, never in the live database.
export function pictureUrl(name, search = location.search) {
  const db = new URLSearchParams(search).get('db');
  const base = db ? `${db === 'local' ? location.origin : db.replace(/\/$/, '')}/GeezSheets/` : 'https://geezjonny.github.io/GeezSheets/';
  return `${base}battlemap/${encodeURIComponent(name)}`;
}
export async function loadPicture(descriptor, get = url => fetch(url), decode = async src => {
  const image = new Image(); image.src = src; await image.decode(); return image;
}, url = pictureUrl) {
  const r = descriptor.rect;
  if (!Array.isArray(r) || r.length !== 4 || !r.every(Number.isFinite) || r[2] <= 0 || r[3] <= 0 || !descriptor.dd2vtt) throw Error('Invalid picture descriptor');
  const response = await get(url(descriptor.dd2vtt));
  if (!response.ok) throw Error(`Picture HTTP ${response.status}`);
  const data = await response.json(), image = data.image;
  if (typeof image !== 'string' || !image) throw Error('Missing dd2vtt image');
  const mime = image.startsWith('/9j/') ? 'jpeg' : image.startsWith('UklGR') ? 'webp' : 'png';
  return {image: await decode(`data:image/${mime};base64,${image}`), rect: r};
}
