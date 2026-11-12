// Catalog content for the launch product, shared by seed.mjs and one-off updates.
// Copy marked "Placeholder" still needs real details — edit it from Admin → Products.

export const category = {
  name: 'Hair Removal',
  slug: 'hair-removal',
  description: 'Natural wax for silky smooth skin — no heating needed.',
};

export const product = {
  slug: 'hair-removal-powder',
  name: 'Hair Removal Powder',
  tagline: 'Smooth skin, naturally.',
  badge: 'New',
  short_description:
    'A natural wax in powder form. Mix it with water, apply, let it dry and wipe away unwanted hair — for silky smooth skin without heating any wax.',
  description: [
    'Hair Removal Powder is a natural wax that comes as a powder. Mix it with a little water into a thick paste, spread it over unwanted hair and let it dry. Then press a wet cotton cloth on the area and rub it off — the hair comes away with the paste.',
    'There is no wax to heat and no warmer to buy. Everything you need is the powder, some water and a cotton cloth, so you can get silky smooth skin at home.',
  ].join('\n\n'),
  price: 299,
  compare_at_price: 399,
  images: ['/images/product/hair-removal-powder.webp'],
  tags: ['hair removal powder', 'natural wax', 'hair removal', 'wax powder', 'smooth skin'],
  rated_for: ['Smooth skin', 'Gentle', 'Easy to use'],
  claims: ['100% natural', 'Gentle on skin', 'Long-lasting smoothness', 'No heating needed'],
  free_from: [],
  ingredients: [],
  highlights: [
    'Just mix with water — no heating needed',
    'Leaves skin silky smooth',
    'Gentle on skin',
    'Long-lasting smoothness',
  ],
  specs: [
    { label: 'Generic name', value: 'Hair removal powder (natural wax)' },
    { label: 'Net quantity', value: 'Placeholder — net quantity per box / sachet' },
    { label: 'Ingredients', value: 'Placeholder — full ingredient list' },
    { label: 'Shelf life', value: 'Placeholder — months from manufacturing' },
    { label: 'Country of origin', value: 'Placeholder — country of origin' },
    { label: 'Marketed by', value: 'Placeholder — your company name & address' },
    { label: 'Customer care', value: 'Placeholder — support email / phone' },
  ],
  faqs: [
    { q: 'How long do I leave it on?', a: '20 to 25 minutes, until the paste has dried hard. Then press a wet cotton cloth on it and rub it off.' },
    { q: 'Do I need to heat it?', a: 'No. Just mix the powder with water into a paste — there is no wax to heat and no warmer needed.' },
    { q: 'Should I do a patch test first?', a: 'Yes. Try a little on a small area 24 hours before first use, and do not use it on broken, irritated or sunburnt skin.' },
  ],
  how_to_use: [
    'Mix the powder with a little water to make a thick, hard paste.',
    'Spread it over the unwanted hair and let it dry for 20–25 minutes.',
    'Press a wet cotton cloth on the area and rub in the opposite direction — the hair comes away with the paste.',
  ],
  weight_grams: 40,
  length_cm: 5,
  breadth_cm: 5,
  height_cm: 10,
  hsn_code: '3307',
  tax_rate: 18,
};

export const variants = [
  { name: '10 g', sku: 'HRP-10', price: 299, compare: 399, stock: 150, weight: 40, badge: null, sort: 1 },
  { name: '20 g', sku: 'HRP-20', price: 499, compare: 699, stock: 100, weight: 60, badge: 'Most popular', sort: 2 },
  { name: 'Pack of 2 × 10 g', sku: 'HRP-10X2', price: 549, compare: 798, stock: 80, weight: 80, badge: 'Best value', sort: 3 },
];

export const store = { name: 'Wax Studio', tagline: 'Natural hair removal powder for smooth skin', brandColor: '#111111' };
