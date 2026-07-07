// Slugify — drops diacritics so "Cómo publicar" → "como-publicar". Falls
// back to a hash if no usable chars remain.
export function slugify(input: string): string {
  const cleaned = (input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (cleaned.length > 0) return cleaned.slice(0, 64);

  // Fallback: time-based hash
  return "post-" + Math.random().toString(36).slice(2, 8);
}

// Ensure slug uniqueness within a set by appending -2, -3, ...
export function uniqueSlug(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
