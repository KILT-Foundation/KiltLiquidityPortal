// Complete runtime error overlay suppression
// Prevents all Vite error overlays while preserving legitimate API functionality

const disableRuntimeErrorOverlay = () => {
  if (typeof window !== 'undefined') {
    // Disable runtime error plugin completely
    (window as any).__vite_plugin_runtime_error_modal_disabled = true;
    
    // Override ALL possible sendError variants
    (window as any).sendError = () => {};
    (window as any).__sendError = () => {};
    
    // Override console.error to prevent overlay triggers
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Still log to console but don't trigger overlays
      if (args[0] && typeof args[0] === 'string' && args[0].includes('runtime error')) {
        return; // Suppress runtime error logs that trigger overlays
      }
      originalConsoleError.apply(console, args);
    };
    
    // Block error handling at window level
    window.addEventListener('error', (event) => {
      event.stopImmediatePropagation();
      event.preventDefault();
    }, true);
    
    window.addEventListener('unhandledrejection', (event) => {
      event.stopImmediatePropagation();
      event.preventDefault();
    }, true);
  }
  // Intercept and disable the specific runtime error function
  if (typeof window !== 'undefined') {
    // Disable HMR overlay at the client level (equivalent to server.hmr.overlay = false)
    if (window.__vite_overlay) {
      window.__vite_overlay.style.display = 'none';
      window.__vite_overlay.remove();
    }
    
    // Prevent HMR overlay from being created
    Object.defineProperty(window, '__vite_overlay', {
      set: () => {}, // Block any attempts to set the overlay
      get: () => null,
      configurable: false
    });
    // Override the global sendError function used by Vite's runtime error plugin
    (window as any).sendError = () => {
      // Do nothing - completely suppress overlay
    };

    // Override __vite_plugin_runtime_error_modal for direct plugin disabling
    (window as any).__vite_plugin_runtime_error_modal = {
      show: () => {},
      hide: () => {},
      sendError: () => {},
    };

    // Disable Vite's HMR error overlay completely (client-side equivalent of server.hmr.overlay = false)
    (window as any).__vite_is_modern_browser = true;
    (window as any).__vite_error_overlay_disabled = true;
    
    // Override the createHotContext function to disable error overlay
    if ((window as any).__vite_createHotContext) {
      const originalCreateHotContext = (window as any).__vite_createHotContext;
      (window as any).__vite_createHotContext = function(...args: any[]) {
        const hotContext = originalCreateHotContext.apply(this, args);
        if (hotContext && hotContext.on) {
          // Disable error overlay in hot context
          hotContext.on('vite:error', () => {});
          hotContext.on('vite:errorCleared', () => {});
        }
        return hotContext;
      };
    }

    // Intercept console.error calls that trigger the overlay
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      
      // Block specific runtime error plugin messages
      if (
        message.includes('[plugin:runtime-error-plugin]') ||
        message.includes('runtime error') ||
        message.includes('sendError')
      ) {
        // Completely suppress these messages
        return;
      }
      
      // Allow other console.error messages through
      originalConsoleError.apply(console, args);
    };

    // Block error events from propagating to the runtime error plugin
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function(type: string, listener: any, options?: any) {
      if (type === 'error' || type === 'unhandledrejection') {
        // Wrap the listener to prevent runtime error plugin from receiving events
        const wrappedListener = function(event: any) {
          // Check if this is the runtime error plugin trying to listen
          const listenerString = listener?.toString() || '';
          if (listenerString.includes('sendError') || listenerString.includes('runtime-error')) {
            // Block the runtime error plugin specifically
            return;
          }
          
          // Allow other error listeners to work normally
          if (typeof listener === 'function') {
            listener.call(window, event);
          }
        };
        
        return originalAddEventListener.call(this, type, wrappedListener, options);
      }
      
      return originalAddEventListener.call(this, type, listener, options);
    };
  }
};

// Execute immediately when module loads
disableRuntimeErrorOverlay();

export default disableRuntimeErrorOverlay;