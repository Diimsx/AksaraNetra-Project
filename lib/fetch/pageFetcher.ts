import type { FetchResult } from '../types';

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB

function detectCaptcha(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  // Look for actual CAPTCHA widgets, not just the word "challenge"
  const captchaPatterns = [
    'class="g-recaptcha"',
    'class="h-captcha"',
    'data-sitekey=',
    'recaptcha/api.js',
    'hcaptcha.com/1/api.js',
    'id="captcha-form"',
    'id="challenge-form"',
    'cf-turnstile',
    'challenges.cloudflare.com',
  ];
  return captchaPatterns.some(pattern => lowerHtml.includes(pattern));
}

function isJsHeavyPage(html: string): boolean {
  // Check if page contains script tags
  if (!/<script\b[^>]*>/i.test(html)) {
    return false;
  }

  // Extract body content roughly
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyContent = html;
  
  if (bodyMatch && bodyMatch[1]) {
    bodyContent = bodyMatch[1];
  }
  
  // Remove script and style tags to estimate visible text
  const visibleText = bodyContent
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\s+/g, ''); // Remove whitespace

  return visibleText.length < 100;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AksaraNetra/1.0 (+https://aksaranetra.id)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchPage(url: string, options?: { timeoutMs?: number }): Promise<FetchResult> {
  const timeoutMs = options?.timeoutMs ?? 10000;

  try {
    const response = await fetchWithTimeout(url, timeoutMs);

    if (response.status === 403) {
      return { success: false, error: 'forbidden' };
    }

    if (response.status === 429) {
      return { success: false, error: 'captcha' };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) {
      return { success: false, error: 'unknown', message: 'Response is not HTML' };
    }

    const contentLengthStr = response.headers.get('content-length');
    if (contentLengthStr) {
      const contentLength = parseInt(contentLengthStr, 10);
      if (contentLength > MAX_RESPONSE_SIZE) {
        return { success: false, error: 'response_too_large' };
      }
    }

    // Read body incrementally
    const reader = response.body?.getReader();
    let html = '';
    
    if (reader) {
      const decoder = new TextDecoder();
      let totalBytes = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (value) {
          totalBytes += value.length;
          if (totalBytes > MAX_RESPONSE_SIZE) {
            reader.cancel();
            return { success: false, error: 'response_too_large' };
          }
          html += decoder.decode(value, { stream: true });
        }
      }
      html += decoder.decode();
    } else {
      // Fallback if no reader available
      const text = await response.text();
      // If we got the text all at once, we need to manually check length again, though Buffer size is better
      if (text.length > MAX_RESPONSE_SIZE) {
        return { success: false, error: 'response_too_large' };
      }
      html = text;
    }

    if (detectCaptcha(html)) {
      return { success: false, error: 'captcha' };
    }

    const needsBrowser = isJsHeavyPage(html);
    if (needsBrowser) {
      console.warn(`[pageFetcher] JS-heavy page detected for URL: ${url}`);
    }

    return {
      success: true,
      html,
      usedBrowser: false,
      ...(needsBrowser ? { needsBrowser: true } : {})
    };

  } catch (error: any) {
    const message = error.message || '';
    const isAbortError = error.name === 'AbortError' || message.toLowerCase().includes('timeout');
    
    if (isAbortError) {
      return { success: false, error: 'timeout' };
    }

    const isSslError = message.toLowerCase().includes('certificate') || 
                       message.toLowerCase().includes('ssl') || 
                       message.toUpperCase().includes('CERT');
                       
    if (isSslError) {
      return { success: false, error: 'ssl_error' };
    }

    return { success: false, error: 'unknown', message: error.message };
  }
}
