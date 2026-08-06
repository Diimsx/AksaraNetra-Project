import type { RemediationResult, RenderResult } from '../types';
import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';

/**
 * Step 1: Sanitize raw HTML — remove scripts, resolve URLs, preserve SVG context.
 * This should run BEFORE remediation so the engine works on clean HTML.
 */
export function sanitizeAndResolve(rawHtml: string, baseUrl: string): string {
    const $ = cheerio.load(rawHtml, null, false);

    // --- Resolve relative URLs ---
    const isAbsolute = (url: string) => {
        return /^https?:\/\//i.test(url) || /^data:/i.test(url) || /^blob:/i.test(url) ||
               url.startsWith('#') || /^mailto:/i.test(url) || /^tel:/i.test(url) || /^javascript:/i.test(url);
    };

    const resolveUrl = (url: string) => {
        if (!url) return url;
        if (isAbsolute(url)) return url;
        try { return new URL(url, baseUrl).toString(); } catch { return url; }
    };

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) $(el).attr('href', resolveUrl(href));
    });

    $('img[src], source[src], video[src], audio[src], link[href]').each((_, el) => {
        const tagName = (el as any).tagName?.toLowerCase() || (el as any).name?.toLowerCase() || '';
        if (tagName === 'link') {
            const href = $(el).attr('href');
            if (href) $(el).attr('href', resolveUrl(href));
        } else {
            const src = $(el).attr('src');
            if (src) $(el).attr('src', resolveUrl(src));
        }
    });

    $('img[srcset], source[srcset]').each((_, el) => {
        const srcset = $(el).attr('srcset');
        if (srcset) {
            const resolved = srcset.split(',').map(part => {
                const trimmed = part.trim();
                const spaceIdx = trimmed.lastIndexOf(' ');
                if (spaceIdx !== -1) {
                    return `${resolveUrl(trimmed.substring(0, spaceIdx))} ${trimmed.substring(spaceIdx + 1)}`;
                }
                return resolveUrl(trimmed);
            }).join(', ');
            $(el).attr('srcset', resolved);
        }
    });

    // --- Preserve SVG accessibility context before sanitization ---
    // SVGs inside links/buttons provide accessible names via <title> or text.
    // Transfer that context to aria-label before sanitize-html strips <svg>.
    $('a, button, [role="button"]').each((_, el) => {
        const $el = $(el);
        if ($el.attr('aria-label')?.trim()) return;

        // Check if has visible text content (excluding SVG internals)
        const cloned = $el.clone();
        cloned.find('svg').remove();
        if (cloned.text().trim().length > 0) return;

        // Try SVG <title>
        const svgTitle = $el.find('svg title').first().text().trim();
        if (svgTitle) { $el.attr('aria-label', svgTitle); return; }

        // Try SVG aria-label
        const svgAriaLabel = $el.find('svg[aria-label]').first().attr('aria-label')?.trim();
        if (svgAriaLabel) { $el.attr('aria-label', svgAriaLabel); return; }

        // Try img alt
        const imgAlt = $el.find('img[alt]').first().attr('alt')?.trim();
        if (imgAlt) { $el.attr('aria-label', imgAlt); }
    });

    const resolvedHtml = $.html();

    // --- Sanitize ---
    const sanitized = sanitizeHtml(resolvedHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            'img', 'figure', 'figcaption', 'main', 'article', 'section', 'nav',
            'header', 'footer', 'aside', 'details', 'summary', 'mark', 'time',
            'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
            'video', 'audio', 'source', 'picture', 'button', 'form', 'input',
            'label', 'select', 'option', 'textarea', 'fieldset', 'legend',
        ]),
        allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            '*': ['class', 'id', 'role', 'aria-label', 'aria-labelledby', 'aria-describedby',
                  'aria-hidden', 'aria-live', 'aria-current', 'tabindex', 'lang', 'dir',
                  'data-*', 'style'],
            'a': ['href', 'title', 'target', 'rel'],
            'img': ['src', 'alt', 'width', 'height', 'loading', 'srcset', 'sizes'],
            'source': ['src', 'srcset', 'type', 'media', 'sizes'],
            'video': ['src', 'poster', 'controls', 'width', 'height'],
            'audio': ['src', 'controls'],
            'td': ['colspan', 'rowspan'],
            'th': ['colspan', 'rowspan', 'scope'],
            'input': ['type', 'name', 'value', 'placeholder', 'required', 'disabled', 'aria-label'],
            'button': ['type', 'name', 'value', 'disabled', 'aria-label'],
            'label': ['for'],
            'form': ['action', 'method'],
            'link': ['rel', 'href', 'type'],
            'time': ['datetime'],
        },
        disallowedTagsMode: 'discard',
        allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
        exclusiveFilter: (frame) => frame.tag === 'script' || frame.tag === 'noscript',
    });

    return sanitized;
}

/**
 * Step 2: Prepare remediated HTML for display — add disclaimer, skip link, ensure <main>.
 * This runs AFTER remediation, on already-clean HTML.
 */
export function prepareForDisplay(remediationResult: RemediationResult, baseUrl: string): RenderResult {
    const $sanitized = cheerio.load(remediationResult.html, null, false);

    // Ensure <main> exists
    const mainEl = $sanitized('main');
    if (mainEl.length === 0) {
        if ($sanitized('body').length > 0) {
            $sanitized('body').wrapInner('<main id="main-content"></main>');
        } else {
            $sanitized.root().wrapInner('<main id="main-content"></main>');
        }
    } else {
        if (!mainEl.attr('id')) {
            mainEl.attr('id', 'main-content');
        }
    }

    // Inject skip link + disclaimer
    const skipLinkStyle = `<style>.aksaranetra-skip-link { position:absolute; top:-100px; left:16px; background:#001e40; color:#fff; padding:16px; font-size:16px; font-weight:600; z-index:1000; border-radius:8px; }\n.aksaranetra-skip-link:focus { top:16px; outline:3px solid #fff; outline-offset:2px; }</style>`;
    const skipLinkHtml = `<a href="#main-content" class="aksaranetra-skip-link">Langsung ke konten utama</a>`;
    const disclaimerHtml = `<div role="banner" aria-label="Peringatan" style="background:#e1e8fd;border-left:4px solid #001e40;padding:16px 24px;margin-bottom:24px;font-size:16px;font-weight:700;color:#43474f;border-radius:8px;">Ini adalah versi tidak resmi yang dihasilkan AksaraNetra. Bukan situs resmi pemerintah.</div>`;
    const injectHtml = skipLinkStyle + skipLinkHtml + disclaimerHtml;

    if ($sanitized('body').length > 0) {
        $sanitized('body').prepend(injectHtml);
    } else {
        $sanitized.root().prepend(injectHtml);
    }

    return {
        safeHtml: $sanitized.html(),
        manualReviewSummary: remediationResult.manualReview,
    };
}
