// Client-side equivalent of server.hmr.overlay = false in vite.config.js
// This completely disables the Vite HMR error overlay at the client level

declare global {
  interface Window {
    __vite_overlay?: HTMLElement;
    __vite_error_overlay_disabled?: boolean;
    __vite_is_modern_browser?: boolean;
    __vite_createHotContext?: (...args: any[]) => any;
  }
}

// Immediately disable HMR overlay when module loads
(function disableViteHMROverlay() {
  if (typeof window === 'undefined') return;

  // Set the global flag to disable error overlay (equivalent to server.hmr.overlay = false)
  window.__vite_error_overlay_disabled = true;
  
  // Remove any existing overlay
  const existingOverlay = document.querySelector('#vite-error-overlay') || 
                         document.querySelector('.vite-error-overlay') ||
                         window.__vite_overlay;
  
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Intercept and disable overlay creation
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName: string, options?: ElementCreationOptions) {
    const element = originalCreateElement.call(this, tagName, options);
    
    // Block creation of error overlay elements
    if (element.id === 'vite-error-overlay' || 
        element.className?.includes('vite-error-overlay')) {
      element.style.display = 'none';
      return element;
    }
    
    return element;
  };

  // Override appendChild to prevent overlay insertion (with null safety)
  if (document.body) {
    const originalAppendChild = document.body.appendChild;
    document.body.appendChild = function<T extends Node>(this: HTMLElement, node: T): T {
      // Block overlay elements from being added to DOM
      if (node instanceof HTMLElement && 
          (node.id === 'vite-error-overlay' || 
           node.className?.includes('vite-error-overlay') ||
           node.innerHTML?.includes('runtime error'))) {
        return node; // Return the node but don't append it
      }
      
      return originalAppendChild.call(this, node) as T;
    };
  } else {
    // If body doesn't exist yet, wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        const originalAppendChild = document.body.appendChild;
        document.body.appendChild = function<T extends Node>(this: HTMLElement, node: T): T {
          // Block overlay elements from being added to DOM
          if (node instanceof HTMLElement && 
              (node.id === 'vite-error-overlay' || 
               node.className?.includes('vite-error-overlay') ||
               node.innerHTML?.includes('runtime error'))) {
            return node; // Return the node but don't append it
          }
          
          return originalAppendChild.call(this, node) as T;
        };
      }
    });
  }

  console.log('Vite HMR overlay disabled (client-side equivalent of server.hmr.overlay = false)');
})();

export {};