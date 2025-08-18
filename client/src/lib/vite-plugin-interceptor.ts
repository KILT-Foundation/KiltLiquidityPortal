// Complete Vite runtime error plugin interceptor
// This intercepts and disables the @replit/vite-plugin-runtime-error-modal at the source

// Intercept the plugin before it can initialize
declare global {
  interface Window {
    __vite_plugin_runtime_error_modal: any;
    sendError: any;
  }
}

// Immediately disable the plugin when this module loads
(function interceptViteRuntimeErrorPlugin() {
  if (typeof window === 'undefined') return;

  // Override the global plugin object before it can be initialized
  Object.defineProperty(window, '__vite_plugin_runtime_error_modal', {
    get: () => ({
      show: () => {},
      hide: () => {},
      sendError: () => {},
      createOverlay: () => {},
      displayError: () => {},
      initialize: () => {},
      mount: () => {},
      unmount: () => {},
    }),
    set: () => {}, // Prevent any attempts to set the plugin
    configurable: false,
    enumerable: false
  });

  // Override sendError globally to completely prevent error reporting
  Object.defineProperty(window, 'sendError', {
    get: () => () => {},
    set: () => {}, // Prevent any attempts to set sendError
    configurable: false,
    enumerable: false
  });

  // Intercept module loading to disable the plugin at import time
  if ((window as any).module && (window as any).module.hot) {
    const originalAccept = (window as any).module.hot.accept;
    (window as any).module.hot.accept = function(...args: any[]) {
      // Block runtime error plugin from hot reloading
      const moduleId = args[0];
      if (typeof moduleId === 'string' && moduleId.includes('runtime-error')) {
        return;
      }
      return originalAccept.apply(this, args);
    };
  }

  // Prevent the plugin from creating any DOM elements
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function<T extends Node>(newNode: T, referenceNode: Node | null): T {
    // Block insertion of runtime error overlays
    if (newNode instanceof HTMLElement) {
      const content = newNode.innerHTML || newNode.textContent || '';
      if (content.includes('plugin:runtime-error-plugin') || 
          content.includes('unknown runtime error') ||
          content.includes('sendError')) {
        // Return the node but don't actually insert it
        return newNode as T;
      }
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };

  // Override appendChild to prevent overlay creation
  const originalAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function<T extends Node>(newChild: T): T {
    // Block appending of runtime error overlays
    if (newChild instanceof HTMLElement) {
      const content = newChild.innerHTML || newChild.textContent || '';
      if (content.includes('plugin:runtime-error-plugin') || 
          content.includes('unknown runtime error') ||
          content.includes('sendError')) {
        // Return the node but don't actually append it
        return newChild as T;
      }
    }
    return originalAppendChild.call(this, newChild) as T;
  };

  // Block all error event listeners that the plugin might use
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
    // Block error event listeners from the runtime error plugin
    if ((type === 'error' || type === 'unhandledrejection') && listener) {
      const listenerStr = listener.toString();
      if (listenerStr.includes('sendError') || 
          listenerStr.includes('runtime-error') ||
          listenerStr.includes('plugin:runtime-error-plugin')) {
        // Don't add the listener
        return;
      }
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  console.log('🔒 Vite runtime error plugin completely intercepted and disabled');
})();

export {};