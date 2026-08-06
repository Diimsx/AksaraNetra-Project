import type { RemediationResult, RemediatedElement, ManualReviewItem } from '../types';
import * as cheerio from 'cheerio';

export function remediate(html: string): RemediationResult {
  const $ = cheerio.load(html);
  const fixed: RemediatedElement[] = [];
  const manualReview: ManualReviewItem[] = [];

  // Fix 1: Links without accessible name (link_name)
  $('a').each((_, el) => {
    const $el = $(el);
    if (!hasAccessibleName($el, $)) {
      const selector = getSelector(el, $);
      const textContent = $el.text().trim();
      const titleAttr = $el.attr('title')?.trim();
      const imgAlt = $el.find('img').map((_i, img) => $(img).attr('alt')).get().find(alt => alt && alt.trim().length > 0)?.trim();
      const parentText = $el.parent().text().trim();

      const source = textContent || titleAttr || imgAlt || parentText;

      if (source) {
        $el.attr('aria-label', source);
        fixed.push({ type: 'link_name', selector, before: null, after: source });
      } else {
        manualReview.push({ type: 'link_name', selector, reason: 'no_context_found' });
      }
    }
  });

  // Fix 2: Buttons without accessible name (button_name)
  $('button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]').each((_, el) => {
    const $el = $(el);
    if (!hasAccessibleName($el, $)) {
      const selector = getSelector(el, $);
      const textContent = $el.text().trim();
      const titleAttr = $el.attr('title')?.trim();
      const classDerived = deriveNameFromClass($el.attr('class') || '');
      const valueAttr = $el.attr('value')?.trim();
      const parentText = $el.parent().text().trim();

      const source = textContent || titleAttr || classDerived || valueAttr || parentText;

      if (source) {
        $el.attr('aria-label', source);
        fixed.push({ type: 'button_name', selector, before: null, after: source });
      } else {
        manualReview.push({ type: 'button_name', selector, reason: 'no_context_found' });
      }
    }
  });

  // Fix 3: Scroll areas not keyboard accessible (scroll_keyboard)
  // Only match elements with INLINE style overflow: auto|scroll (not hidden, not class-based)
  const scrollStyleRegex = /overflow(?:-[xy])?\s*:\s*(auto|scroll)/i;
  const skipTags = new Set(['html', 'head', 'body', 'script', 'style', 'meta', 'link', 'title']);

  $('*').each((_, el) => {
    const tagName = (el as any).tagName || (el as any).name || '';
    if (skipTags.has(tagName.toLowerCase())) return;

    const $el = $(el);
    const style = $el.attr('style') || '';

    // Only trigger on explicit inline overflow: auto or overflow: scroll
    if (!scrollStyleRegex.test(style)) return;

    // Skip if already has tabindex
    if ($el.attr('tabindex') !== undefined) return;

    $el.attr('tabindex', '0');
    fixed.push({ type: 'scroll_keyboard', selector: getSelector(el, $), before: null, after: 'tabindex=0' });

    const hasAriaLabel = !!$el.attr('aria-label');
    const hasAriaLabelledBy = !!$el.attr('aria-labelledby');
    const hasRole = !!$el.attr('role');

    if (!hasAriaLabel && !hasAriaLabelledBy && !hasRole) {
      $el.attr('role', 'region');
      $el.attr('aria-label', 'Area konten yang dapat digulir');
    }
  });

  // Since $.html() wraps in html/head/body if they aren't there, we need to extract body inner HTML if it was a fragment
  // However, $.html() on cheerio loaded without `isDocument: false` might include <html>. 
  // Next.js components might be fragments. Let's just return $.html() assuming it handles fragments properly.
  // Actually cheerio.load(html, { isDocument: false }) prevents wrapper, but prompt doesn't specify.
  // We'll return $.html() as requested.
  
  return {
    html: $.html(),
    fixed,
    manualReview,
  } as RemediationResult; // Cast to ensure it matches user's types
}

function getSelector(el: any, $: cheerio.CheerioAPI): string {
  let selector = (el.tagName || el.name || 'unknown') as string;
  const $el = $(el);
  const id = $el.attr('id');
  if (id) {
    selector += `#${id}`;
  }
  const cls = $el.attr('class');
  if (cls) {
    selector += `.${cls.trim().split(/\s+/).join('.')}`;
  }
  return selector;
}

function hasAccessibleName($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): boolean {
  if ($el.text().trim().length > 0) return true;
  if ($el.attr('aria-label') && $el.attr('aria-label')!.trim().length > 0) return true;
  if ($el.attr('aria-labelledby') && $el.attr('aria-labelledby')!.trim().length > 0) return true;
  if ($el.attr('title') && $el.attr('title')!.trim().length > 0) return true;
  return false;
}

function deriveNameFromClass(classAttr: string): string | null {
  if (!classAttr) return null;
  const classes = classAttr.toLowerCase().split(/\s+/);
  const mapping: Record<string, string> = {
    close: 'Tutup',
    search: 'Cari',
    menu: 'Menu',
    toggle: 'Alihkan',
    submit: 'Kirim',
    cancel: 'Batal',
    delete: 'Hapus',
    remove: 'Hapus',
    edit: 'Ubah',
    add: 'Tambah',
    plus: 'Tambah',
    back: 'Kembali',
    next: 'Selanjutnya',
    prev: 'Sebelumnya',
    previous: 'Sebelumnya',
  };

  for (const cls of classes) {
    for (const key in mapping) {
      if (cls.includes(key)) {
        return mapping[key];
      }
    }
  }
  return null;
}
