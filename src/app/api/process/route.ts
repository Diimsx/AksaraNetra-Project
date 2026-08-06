import { NextResponse } from 'next/server';
import { validateUrl } from '../../../../lib/security/urlValidator';
import { fetchPage } from '../../../../lib/fetch/pageFetcher';
import { remediate } from '../../../../lib/remediation/engine';
import { prepareForDisplay } from '../../../../lib/render/renderer';
import * as cheerio from 'cheerio';

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
        { error: 'Parameter URL wajib diisi', code: 'INVALID_URL' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ─── Module 1: URL Validator ───
    const validation = await validateUrl(targetUrl);

    if (!validation.valid) {
      const reasonMessages: Record<string, string> = {
        invalid_format: 'Format URL tidak valid. Gunakan http:// atau https://',
        blocked_host: 'Alamat host diblokir karena alasan keamanan',
        robots_disallowed: 'Situs ini melarang akses otomatis via robots.txt',
        too_many_redirects: 'Terlalu banyak redirect (maksimum 3)',
      };
      return NextResponse.json(
        { error: reasonMessages[validation.reason], code: 'INVALID_URL', reason: validation.reason },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const validatedUrl = validation.url;

    // ─── Module 2: Page Fetcher ───
    const fetchResult = await fetchPage(validatedUrl);

    if (!fetchResult.success) {
      const errorMessages: Record<string, string> = {
        timeout: 'Waktu koneksi habis saat mengambil halaman',
        forbidden: 'Akses ke halaman ditolak oleh server (403)',
        captcha: 'Halaman memerlukan verifikasi CAPTCHA',
        ssl_error: 'Terjadi kesalahan sertifikat SSL/TLS',
        response_too_large: 'Ukuran halaman terlalu besar (maks 5MB)',
        unknown: fetchResult.message || 'Gagal mengambil halaman',
      };
      return NextResponse.json(
        { error: errorMessages[fetchResult.error], code: 'FETCH_FAILED', reason: fetchResult.error },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    // ─── Extract page title ───
    const $raw = cheerio.load(fetchResult.html);
    const pageTitle = $raw('title').text().trim() || 'Tanpa Judul';

    // ─── Module 4: Remediation Engine ───
    const remediationResult = remediate(fetchResult.html);

    // ─── Module 5: Renderer ───
    const renderResult = prepareForDisplay(remediationResult, validatedUrl);

    // ─── Build response ───
    return NextResponse.json(
      {
        title: pageTitle,
        description: 'Dokumen ini telah diremediasi oleh AksaraNetra untuk memastikan aksesibilitas digital tingkat lanjut, mematuhi standar WCAG 2.1 AAA.',
        content: renderResult.safeHtml,
        originalUrl: targetUrl,
        processedAt: new Date().toISOString(),
        fixedCount: remediationResult.fixed.length,
        manualReviewCount: remediationResult.manualReview.length,
        fixes: remediationResult.fixed,
        manualReview: renderResult.manualReviewSummary,
      },
      { headers: CORS_HEADERS }
    );

  } catch (error) {
    console.error('[api/process] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan yang tidak terduga', code: 'PARSE_ERROR' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
