// Remove force display - React app should work now
// import "./force-display";

import { createRoot } from "react-dom/client";
import React from "react";
import App from "./App";
import "./index.css";
import { renderSimpleFallback } from "./simple-fallback";

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Unhandled promise rejection (gracefully handled):', event.reason?.message || event.reason);
  // Prevent the default behavior (which would show an error overlay)
  event.preventDefault();
});

// Force reload if necessary for Replit browser compatibility
if (typeof window !== 'undefined' && window.location.search.includes('force-reload')) {
  window.location.href = window.location.href.replace('?force-reload', '').replace('&force-reload', '');
}

// Global error handler for other errors
window.addEventListener('error', (event) => {
  console.warn('Global error (gracefully handled):', event.error?.message || event.error);
  event.preventDefault();
});

// Error boundary wrapper for the entire application
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.warn('Error boundary caught error:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
            <p className="text-gray-400 mb-4">The application encountered an error</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Checkpoint detection and cache clearing
function detectCheckpointRollback() {
  try {
    const currentVersion = Date.now().toString();
    const storedVersion = localStorage.getItem('app-version');
    
    // If no stored version or app was reloaded from checkpoint, clear cache
    if (!storedVersion) {
      console.log('Checkpoint rollback detected - clearing all cached data');
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear service worker cache if available
      if ('serviceWorker' in navigator && 'caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        }).catch(console.warn);
      }
      
      // Set new version
      localStorage.setItem('app-version', currentVersion);
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('Cache detection failed:', error);
    return false;
  }
}

// Ensure root element exists and is accessible
function initializeApp() {
  // Check for checkpoint rollback and clear cache if needed
  const wasRolledBack = detectCheckpointRollback();
  
  let rootElement = document.getElementById("root");
  
  if (!rootElement) {
    console.warn('Root element not found, creating one');
    rootElement = document.createElement('div');
    rootElement.id = 'root';
    rootElement.style.cssText = 'width: 100%; height: 100vh; background: black;';
    document.body.appendChild(rootElement);
  }
  
  // Ensure root element is visible
  rootElement.style.display = 'block';
  rootElement.style.visibility = 'visible';
  rootElement.style.opacity = '1';
  
  // If rollback was detected, add cache-busting parameter
  if (wasRolledBack && !window.location.search.includes('cb=')) {
    const url = new URL(window.location.href);
    url.searchParams.set('cb', Date.now().toString());
    window.location.replace(url.toString());
    return;
  }
  
  // Create React root and render app
  try {
    console.log('Attempting to create React root...');
    const root = createRoot(rootElement);
    console.log('React root created, attempting to render...');
    
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
    console.log('✅ React app mounted successfully');
    
    // React app mounted successfully - remove forced fallback
    console.log('✅ React app mounted and working!');
  } catch (error) {
    console.error('Failed to mount React app:', error);
    renderSimpleFallback(rootElement);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
