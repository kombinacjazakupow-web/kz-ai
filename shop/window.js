import { isSoldOut } from '#variants';

const DOTS = {
  czarny: '#1c1c1c',
  bialy: '#f4f1ea',
  bez: '#d9c4a4',
  bezowy: '#d9c4a4',
  ecru: '#f3ead7',
  granat: '#1b2a4a',
  granatowy: '#1b2a4a',
  czerwony: '#8e2f2f',
  rozowy: '#e4b4c4',
  roz: '#e4b4c4',
  zielony: '#2f4f3e',
  brazowy: '#6b4630',
  szary: '#8a8680',
  zolty: '#e2c15a',
  fiolet: '#5b3d78',
  fioletowy: '#5b3d78',
  bordowy: '#6e2430',
  niebieski: '#3d5f8a',
  bezowy2: '#d9c4a4',
};

function fold(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('pl')
    .replaceAll('ą', 'a')
    .replaceAll('ć', 'c')
    .replaceAll('ę', 'e')
    .replaceAll('ł', 'l')
    .replaceAll('ń', 'n')
    .replaceAll('ó', 'o')
    .replaceAll('ś', 's')
    .replaceAll('ź', 'z')
    .replaceAll('ż', 'z');
}

export function newestDrop(products, variants) {
  const list = (Array.isArray(products) ? products : []).filter((item) => item && item.active !== false);
  const open = list.filter((item) => !isSoldOut(item, variants));
  const pool = open.length ? open : list;
  return pool.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;
}

export function dropRail(products, variants, limit = 8) {
  const hero = newestDrop(products, variants);
  const list = (Array.isArray(products) ? products : [])
    .filter((item) => item && item.active !== false && !isSoldOut(item, variants) && item !== hero && item.id !== hero?.id)
    .slice()
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return list.slice(0, limit);
}

export function dotPaint(name) {
  return DOTS[fold(name)] || '#c4b7a6';
}

export function visibleDots(views) {
  return (Array.isArray(views) ? views : [])
    .filter((view) => view && (view.stock == null || view.stock > 0))
    .slice(0, 6);
}
