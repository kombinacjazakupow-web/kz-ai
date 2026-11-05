export const INTEREST_KEY = 'kombi-shop-interest';

export const SOON = [
  { id: 'vip', title: 'Karta VIP', text: 'Wkrótce. Zapis zostaje tylko na tym telefonie.' },
  { id: 'multi', title: 'Promocje przy kilku sztukach', text: 'Wkrótce. Nie ma jeszcze promocji do pokazania.' },
  { id: 'wholesale', title: 'Hurt i zestawy', text: 'Wkrótce. Zapis zostaje tylko na tym telefonie.' },
];

export function toggleInterest(saved, id) {
  const list = Array.isArray(saved) ? saved.filter((item) => typeof item === 'string' && item) : [];
  if (!id || !SOON.some((item) => item.id === id)) return list;
  if (list.includes(id)) return list.filter((item) => item !== id);
  return [...list, id];
}
