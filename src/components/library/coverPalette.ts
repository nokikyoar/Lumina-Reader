export interface CoverPalette {
  name: string;
  bg1: string;
  bg2: string;
  bg3?: string;
  text: string;
  subtleText: string;
}

const COVER_PALETTES: CoverPalette[] = [
  {
    name: 'Tiffany Blue',
    bg1: '#81D8D0',
    bg2: '#5FC6BE',
    bg3: '#3FAEA6',
    text: '#F8FFFE',
    subtleText: 'rgba(248,255,254,0.82)',
  },
  {
    name: 'Burgundy Red',
    bg1: '#7B1E3B',
    bg2: '#5E142C',
    bg3: '#43101F',
    text: '#FFF6F8',
    subtleText: 'rgba(255,246,248,0.8)',
  },
  {
    name: 'Oxford Navy',
    bg1: '#1D3557',
    bg2: '#14243A',
    bg3: '#0F1B2D',
    text: '#F3F7FF',
    subtleText: 'rgba(243,247,255,0.82)',
  },
  {
    name: 'Forest Emerald',
    bg1: '#1F6F5D',
    bg2: '#165344',
    bg3: '#113C32',
    text: '#F2FFF9',
    subtleText: 'rgba(242,255,249,0.8)',
  },
  {
    name: 'Imperial Purple',
    bg1: '#5D3A8C',
    bg2: '#472B6D',
    bg3: '#331F4F',
    text: '#F7F2FF',
    subtleText: 'rgba(247,242,255,0.82)',
  },
  {
    name: 'Champagne Gold',
    bg1: '#C7A96B',
    bg2: '#A98A52',
    bg3: '#83693B',
    text: '#FFFDF7',
    subtleText: 'rgba(255,253,247,0.82)',
  },
  {
    name: 'Slate Rose',
    bg1: '#8F5F73',
    bg2: '#724B5C',
    bg3: '#543744',
    text: '#FFF7FA',
    subtleText: 'rgba(255,247,250,0.8)',
  },
  {
    name: 'Smoky Teal',
    bg1: '#2F6F74',
    bg2: '#25575B',
    bg3: '#1A3E41',
    text: '#F3FFFF',
    subtleText: 'rgba(243,255,255,0.82)',
  },
];

export function pickCoverPalette(seed: string): CoverPalette {
  const safeSeed = (seed || 'book').trim();
  let hash = 0;
  for (let i = 0; i < safeSeed.length; i += 1) {
    hash = safeSeed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COVER_PALETTES.length;
  return COVER_PALETTES[index];
}
