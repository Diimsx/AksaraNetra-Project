import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

function isPrivateIP(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  
  if (match) {
    const parts = match.slice(1).map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }
  
  if (hostname === '[::1]' || hostname === '::1') return true;
  
  return false;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, max-age=0',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'URL parameter is required', code: 'INVALID_URL' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format', code: 'INVALID_URL' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'Invalid protocol. Use http or https.', code: 'INVALID_URL' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (isPrivateIP(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: 'Private or local IP addresses are not allowed', code: 'INVALID_URL' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'AksaraNetra Bot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Failed to fetch the URL', code: 'FETCH_FAILED' },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch the URL, status: ${response.status}`, code: 'FETCH_FAILED' },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return NextResponse.json(
        { error: 'Response is not HTML', code: 'PARSE_ERROR' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const html = await response.text();
    if (!html) {
      return NextResponse.json(
        { error: 'Empty response body', code: 'PARSE_ERROR' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const $ = cheerio.load(html);
    const title = $('title').text().trim() || 'No Title';

    // Remove unwanted tags
    $('script, style, noscript, iframe, svg').remove();

    // Find main content
    let mainContent = $('main');
    if (mainContent.length === 0) {
      mainContent = $('article');
    }
    if (mainContent.length === 0) {
      mainContent = $('[role="main"]');
    }
    if (mainContent.length === 0) {
      mainContent = $('body');
    }

    // Process headings for rudimentary hierarchy
    let currentLevel = 0;
    mainContent.find(':header').each((_, el) => {
      const level = parseInt(el.tagName.substring(1), 10);
      if (currentLevel === 0) {
        currentLevel = level;
      } else if (level > currentLevel + 1) {
        // Enforce hierarchy by demoting skipping headers
        el.tagName = `h${currentLevel + 1}`;
        currentLevel++;
      } else {
        currentLevel = level;
      }
    });

    // Process images
    mainContent.find('img').each((_, el) => {
      const $img = $(el);
      if (!$img.attr('alt')) {
        $img.attr('alt', 'Gambar dekoratif');
      }
    });

    // Process links
    mainContent.find('a').each((_, el) => {
      const $a = $(el);
      if (!$a.text().trim() && !$a.attr('aria-label')) {
        $a.attr('aria-label', 'Tautan');
      }
    });

    // Clean empty elements
    mainContent.find('p, span, div').each((_, el) => {
      const $el = $(el);
      if ($el.children().length === 0 && !$el.text().trim()) {
        $el.remove();
      }
    });

    const contentHtml = mainContent.html() || '';

    return NextResponse.json(
      {
        title,
        description: "Dokumen ini telah diremediasi oleh AksaraNetra untuk memastikan aksesibilitas digital tingkat lanjut, mematuhi standar WCAG 2.1 AAA.",
        content: contentHtml,
        originalUrl: targetUrl,
        processedAt: new Date().toISOString()
      },
      { headers: CORS_HEADERS }
    );

  } catch (error) {
    return NextResponse.json(
      { error: 'An unexpected error occurred', code: 'PARSE_ERROR' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
