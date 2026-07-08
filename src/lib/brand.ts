// DCB (Drocon Bharat) brand palette, from the Brand & Document Design System.
export interface NamedColor {
  name: string
  hex: string
}

export const BRAND_COLORS: NamedColor[] = [
  { name: 'DCB Green', hex: '#599533' },
  { name: 'DCB Orange', hex: '#F48A1C' },
  { name: 'DCB Blue', hex: '#0A6496' },
  { name: 'Charcoal', hex: '#282828' },
  { name: 'Teal', hex: '#0F9ED5' },
  { name: 'Purple', hex: '#A02B93' },
  { name: 'Magenta', hex: '#C23082' },
  { name: 'Leaf', hex: '#4EA72E' },
]

// Map a stored hex back to its brand name for display; fall back to the hex.
export function colorName(hex: string): string {
  const match = BRAND_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())
  return match ? match.name : hex
}
