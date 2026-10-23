// Fills the {{BRAND_*}} marks of index.html with the values of src/brand.ts. Kept apart from
// the Vite config so a test can run the same replacement on the real index.html.
import { BRAND, BRAND_SPOKEN } from './brand';

const MARKS: Record<string, string> = {
  '{{BRAND_NAME}}': BRAND.name,
  '{{BRAND_LIGHT}}': BRAND.light,
  '{{BRAND_BOLD}}': BRAND.bold,
  '{{BRAND_SPOKEN}}': BRAND_SPOKEN,
  '{{BRAND_PLACE}}': BRAND.place,
  '{{BRAND_TAGLINE}}': BRAND.tagline,
  '{{BRAND_DESCRIPTION}}': BRAND.description,
};

export function applyBrand(html: string): string {
  let out = html;
  for (const [mark, value] of Object.entries(MARKS)) out = out.split(mark).join(value);
  return out;
}
