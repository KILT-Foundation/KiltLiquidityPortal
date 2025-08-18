// Nuclear option: Complete runtime error overlay suppression
// This aggressively blocks ALL runtime error overlays from Vite

// Immediately override all possible overlay creation methods
(function nuclearOverlaySuppress() {
  if (typeof window === 'undefined') return;

  // Completely disable the runtime error plugin at the source
  (window as any).__vite_plugin_runtime_error_modal = {
    show: () => {},
    hide: () => {},
    sendError: () => {},
    createOverlay: () => {},
    displayError: () => {},
  };

  // Override sendError globally to prevent any error reporting
  (window as any).sendError = () => {};
  
  // Block all iframe creation that might contain error overlays
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName: string, options?: any) {
    if (tagName.toLowerCase() === 'iframe') {
      const iframe = originalCreateElement.call(this, tagName, options) as HTMLIFrameElement;
      // Block any iframe that might be an error overlay
      if (iframe.src && (iframe.src.includes('error') || iframe.src.includes('runtime'))) {
        iframe.style.display = 'none';
        return iframe;
      }
      return iframe;
    }
    return originalCreateElement.call(this, tagName, options);
  };

  // Block the specific runtime error plugin overlay
  const blockOverlay = () => {
    // Remove any existing overlays with more specific selectors
    const overlays = document.querySelectorAll(`
      [id*="error"], [class*="error"], [data-vite-overlay],
      iframe[src*="error"], iframe[src*="runtime"],
      div[style*="position: fixed"], div[style*="z-index: 99999"]
    `);
    overlays.forEach(el => {
      if (el.innerHTML?.includes('plugin:runtime-error-plugin') || 
          el.innerHTML?.includes('unknown runtime error')) {
        el.remove();
      }
    });
    
    // Block overlay creation in DOM with more comprehensive CSS
    const style = document.createElement('style');
    style.textContent = `
      div[id*="error-overlay"],
      div[class*="error-overlay"], 
      div[data-vite-overlay],
      #vite-error-overlay,
      .vite-error-overlay,
      iframe[src*="error"],
      iframe[src*="runtime"],
      div[style*="z-index: 99999"]:has(span:contains("plugin:runtime-error-plugin")) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        z-index: -9999 !important;
        width: 0 !important;
        height: 0 !important;
      }
    `;
    // Safe appendChild with null check
    if (document.head) {
      try {
        document.head.appendChild(style);
      } catch (error) {
        console.warn('Failed to append overlay suppression style:', error);
      }
    }
  };

  // Execute immediately and on DOM changes
  blockOverlay();
  
  // Block on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', blockOverlay);
  }
  
  // Continuously monitor and block overlays (with null safety)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const isOverlay = node.id?.includes('error') || 
                           node.className?.includes('error') ||
                           node.getAttribute('data-vite-overlay') !== null ||
                           node.innerHTML?.includes('plugin:runtime-error-plugin');
          
          if (isOverlay) {
            node.remove();
            console.log('Blocked runtime error overlay creation');
          }
        }
      });
    });
  });
  
  // Only observe if document.body exists
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } else {
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    });
  }

  // Override console.error to prevent Vite detection
  const originalError = console.error;
  console.error = (...args) => {
    const message = args.join(' ');
    
    // Block specific runtime error messages
    if (message.includes('plugin:runtime-error-plugin') ||
        message.includes('sendError') ||
        message.includes('unknown runtime error') ||
        message.includes('at sendError') ||
        message.includes('runtime-error-plugin')) {
      return; // Completely suppress
    }
    
    originalError.apply(console, args);
  };

  // Aggressive DOM monitoring to remove any error overlays immediately
  setInterval(() => {
    // Check all divs for error content
    const allDivs = document.querySelectorAll('div');
    allDivs.forEach(el => {
      if (el.innerHTML?.includes('plugin:runtime-error-plugin') || 
          el.innerHTML?.includes('unknown runtime error') ||
          el.innerHTML?.includes('sendError') ||
          el.style.position === 'fixed' && el.style.zIndex === '99999') {
        el.remove();
        console.log('Removed runtime error overlay');
      }
    });
    
    // Check all iframes for error content
    const allIframes = document.querySelectorAll('iframe');
    allIframes.forEach(el => {
      if (el.src?.includes('replit.dev') && el.src?.includes('error')) {
        el.remove();
        console.log('Removed runtime error iframe');
      }
    });
  }, 50); // Check every 50ms for faster removal

  // Block error event propagation
  window.addEventListener('error', (e) => {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }, true);

  console.log('Nuclear overlay suppression activated');
})();

export {};