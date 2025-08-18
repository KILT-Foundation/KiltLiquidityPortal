/**
 * Render Emergency Fix - Critical rendering issue resolver
 * This module ensures React components can mount properly even with DOM issues
 */

// Emergency render fix to ensure React can mount
export function initializeRenderEmergencyFix(): void {
  // Wait for DOM to be completely ready
  const ensureReactMount = () => {
    let rootElement = document.getElementById('root');
    
    if (!rootElement) {
      console.log('Creating root element for React mounting');
      const body = document.body;
      if (body) {
        const newRoot = document.createElement('div');
        newRoot.id = 'root';
        newRoot.style.cssText = 'width: 100%; height: 100vh; background: black; display: block;';
        body.appendChild(newRoot);
        rootElement = newRoot;
      }
    }
    
    // Ensure root element is always visible
    if (rootElement) {
      rootElement.style.display = 'block';
      rootElement.style.visibility = 'visible';
      rootElement.style.opacity = '1';
      rootElement.style.width = '100%';
      rootElement.style.height = '100vh';
      rootElement.style.background = 'black';
    }
  };
  
  // Execute immediately and on various events
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureReactMount);
  } else {
    ensureReactMount();
  }
  
  // Fallback execution
  setTimeout(ensureReactMount, 100);
  setTimeout(ensureReactMount, 500);
  setTimeout(ensureReactMount, 1000);
  
  console.log('🚑 Render emergency fix initialized');
}

// Force visible root element styles
export function forceRootVisibility(): void {
  const style = document.createElement('style');
  style.textContent = `
    #root {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: 100% !important;
      height: 100vh !important;
      background: black !important;
    }
    
    body {
      margin: 0 !important;
      padding: 0 !important;
      background: black !important;
    }
    
    html {
      background: black !important;
    }
  `;
  
  // Wait for head to be available
  const addStyle = () => {
    if (document.head) {
      document.head.appendChild(style);
      console.log('🎯 Root visibility styles injected');
    } else {
      setTimeout(addStyle, 50);
    }
  };
  
  addStyle();
}

// Initialize immediately
initializeRenderEmergencyFix();
forceRootVisibility();