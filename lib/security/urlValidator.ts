import type { ValidationResult } from '../types';

function isPrivateHost(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();
  
  if (
    lowerHost === 'localhost' ||
    lowerHost === '127.0.0.1' ||
    lowerHost === '::1' ||
    lowerHost === '[::1]' ||
    lowerHost === '169.254.169.254'
  ) {
    return true;
  }

  // IPv4 Private Ranges
  if (lowerHost.startsWith('10.')) {
    return true;
  }
  
  if (lowerHost.startsWith('192.168.')) {
    return true;
  }

  if (lowerHost.startsWith('172.')) {
    const parts = lowerHost.split('.');
    if (parts.length === 4) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }
  }

  return false;
}

function parseRobotsTxt(robotsTxt: string, path: string): boolean {
  const lines = robotsTxt.split(/\r?\n/);
  let isTargetUserAgent = false;
  let disallowed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const lowerLine = trimmed.toLowerCase();
    
    if (lowerLine.startsWith('user-agent:')) {
      const agent = lowerLine.substring(11).trim();
      isTargetUserAgent = agent === 'aksaranetra' || agent === '*';
    } else if (isTargetUserAgent && lowerLine.startsWith('disallow:')) {
      const rulePath = trimmed.substring(9).trim();
      if (rulePath && path.startsWith(rulePath)) {
        disallowed = true;
      }
    } else if (isTargetUserAgent && lowerLine.startsWith('allow:')) {
      const rulePath = trimmed.substring(6).trim();
      if (rulePath && path.startsWith(rulePath)) {
        disallowed = false;
      }
    }
  }

  return disallowed;
}

export async function validateUrl(input: string): Promise<ValidationResult> {
  let currentUrlStr = input;
  let redirectCount = 0;

  while (redirectCount <= 3) {
    let url: URL;
    try {
      url = new URL(currentUrlStr);
    } catch {
      return { valid: false, reason: 'invalid_format' };
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { valid: false, reason: 'invalid_format' };
    }

    if (isPrivateHost(url.hostname)) {
      return { valid: false, reason: 'blocked_host' };
    }

    // Check robots.txt
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const robotsUrl = `${url.origin}/robots.txt`;
      const response = await fetch(robotsUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'AksaraNetra' }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const robotsTxt = await response.text();
        const pathToCheck = url.pathname + url.search;
        if (parseRobotsTxt(robotsTxt, pathToCheck)) {
          return { valid: false, reason: 'robots_disallowed' };
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`robots.txt timeout for ${url.origin}`);
      }
      // If fetch fails or timeout, we default permit (allow)
    }

    // Check redirect
    try {
      const response = await fetch(url.toString(), {
        method: 'HEAD',
        redirect: 'manual',
        headers: { 'User-Agent': 'AksaraNetra' }
      });

      if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
        const location = response.headers.get('location');
        if (location) {
          redirectCount++;
          if (redirectCount > 3) {
            return { valid: false, reason: 'too_many_redirects' };
          }
          currentUrlStr = new URL(location, url.toString()).toString();
          continue;
        }
      }
      
      // No redirect
      break;
    } catch (error) {
      // If HEAD request fails, we assume no redirect and it's valid
      break;
    }
  }

  return { valid: true, url: currentUrlStr };
}
