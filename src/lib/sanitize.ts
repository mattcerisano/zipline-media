/**
 * Sanitizes user-provided URLs to prevent DOM-based XSS (e.g. javascript: or data: links)
 * while allowing standard protocol links (http://, https://, mailto:, tel:) and safe relative paths.
 */
export const sanitizeUrl = (url: string | undefined | null): string => {
  if (!url) return '#';
  const trimmed = url.trim();
  
  // Protect against javascript: and data: URLs
  const isBannedProtocol = /^(javascript|data):/i.test(trimmed);
  if (isBannedProtocol) {
    console.warn("Blocked potentially unsafe URL protocol:", trimmed);
    return '#';
  }
  
  // Verify it is a valid protocol or safe relative/anchor link
  const isValidLink = /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(trimmed);
  if (isValidLink) {
    return trimmed;
  }
  
  // If it's a domain name without protocol (e.g. "google.com"), prefix it with https://
  if (/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  
  return '#';
};
