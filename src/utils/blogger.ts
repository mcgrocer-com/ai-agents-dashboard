/**
 * Blogger utility functions
 */

/**
 * Add target="_blank" and rel="noopener noreferrer" to all links in HTML content
 * This ensures all hyperlinks open in a new tab for better UX
 */
export function addTargetBlankToLinks(html: string): string {
  if (!html) return html;

  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find all anchor tags
  const links = doc.querySelectorAll('a');

  // Add target and rel attributes to each link
  links.forEach((link) => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });

  // Return the modified HTML
  return doc.body.innerHTML;
}
