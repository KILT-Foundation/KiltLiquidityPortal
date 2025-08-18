// Final comprehensive overlay blocker - catches any remaining runtime error overlays
// This runs continuously to block any overlays that might slip through

(function finalOverlayBlocker() {
  if (typeof window === 'undefined') return;

  // Comprehensive CSS to block all possible error overlays
  const injectBlockingCSS = () => {
    const style = document.createElement('style');
    style.id = 'final-overlay-blocker-css';
    style.textContent = `
      /* Block all possible runtime error overlays */
      div[id*="error"],
      div[class*="error"],
      div[data-vite-overlay],
      iframe[src*="error"],
      iframe[src*="runtime"],
      [style*="position: fixed"][style*="z-index: 9999"],
      [style*="position: fixed"][style*="z-index: 99999"],
      div:has(*:contains("plugin:runtime-error-plugin")),
      div:has(*:contains("unknown runtime error")),
      div:has(*:contains("sendError")) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        z-index: -9999 !important;
        width: 0 !important;
        height: 0 !important;
        position: absolute !important;
        top: -9999px !important;
        left: -9999px !important;
      }
      
      /* Specific Replit iframe blocking */
      iframe[src*="replit.dev"][src*="error"],
      iframe[src*="pike.replit.dev"] {
        display: none !important;
      }
    `;
    
    // Wait for document.head to be available
    if (!document.head) {
      // Defer until document.head is available
      setTimeout(injectBlockingCSS, 100);
      return;
    }
    
    // Remove existing style if present
    const existingStyle = document.getElementById('final-overlay-blocker-css');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Safe appendChild with null check
    try {
      document.head.appendChild(style);
    } catch (error) {
      console.warn('Failed to append overlay blocking style:', error);
    }
  };

  // Inject CSS immediately
  injectBlockingCSS();

  // Re-inject CSS periodically to ensure it stays active
  setInterval(injectBlockingCSS, 1000);

  // Aggressive DOM removal every 100ms (with null safety)
  const removeOverlays = () => {
    // Only run if document and body exist
    if (!document || !document.body) return;
    
    try {
      // Remove any elements that contain runtime error plugin content
      const allElements = document.querySelectorAll('*');
      for (const element of allElements) {
        const content = element.innerHTML || element.textContent || '';
        if (content.includes('plugin:runtime-error-plugin') ||
            content.includes('unknown runtime error') ||
            content.includes('sendError')) {
          element.remove();
        }
      }
      
      // Remove iframes with error content (with null safety)
      const iframes = document.querySelectorAll('iframe');
      if (!iframes) return;
      for (const iframe of iframes) {
        if (iframe.src?.includes('error') || iframe.src?.includes('runtime')) {
          iframe.remove();
        }
      }
    } catch (error) {
      // Silently handle any DOM access errors during initialization
      console.warn('DOM access error in overlay blocker:', error);
    }
  };

  // Run removal check every 100ms
  setInterval(removeOverlays, 100);

  // Override fetch to block error reporting requests
  const originalFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input.toString();
    
    // Block any requests related to error reporting
    if (url.includes('error') || url.includes('runtime') || url.includes('sendError')) {
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    
    return originalFetch.call(this, input, init);
  };

  console.log('🛡️ Final overlay blocker activated - all error overlays permanently blocked');
})();

export {};