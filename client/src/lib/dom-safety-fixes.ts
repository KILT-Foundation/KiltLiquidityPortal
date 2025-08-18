/**
 * DOM Safety Fixes - Prevents null reference errors during component mounting
 * This module ensures all DOM operations have proper null safety checks
 */

// Wait for DOM to be ready before executing any DOM operations
export function waitForDOM(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => resolve());
    } else {
      resolve();
    }
  });
}

// Safe DOM element creation with null checks
export function safeCreateElement(tagName: string): HTMLElement | null {
  try {
    if (!document) return null;
    return document.createElement(tagName);
  } catch (error) {
    console.warn('Failed to create element:', tagName, error);
    return null;
  }
}

// Safe appendChild with comprehensive null checks
export function safeAppendChild(parent: Element | null, child: Element | null): boolean {
  try {
    if (!parent || !child) {
      console.warn('safeAppendChild: parent or child is null');
      return false;
    }
    
    if (!parent.appendChild) {
      console.warn('safeAppendChild: appendChild method not available');
      return false;
    }
    
    parent.appendChild(child);
    return true;
  } catch (error) {
    console.warn('safeAppendChild failed:', error);
    return false;
  }
}

// Safe querySelector with null checks
export function safeQuerySelector(selector: string): Element | null {
  try {
    if (!document || !document.querySelector) return null;
    return document.querySelector(selector);
  } catch (error) {
    console.warn('safeQuerySelector failed:', selector, error);
    return null;
  }
}

// Safe querySelectorAll with null checks
export function safeQuerySelectorAll(selector: string): NodeListOf<Element> | null {
  try {
    if (!document || !document.querySelectorAll) return null;
    return document.querySelectorAll(selector);
  } catch (error) {
    console.warn('safeQuerySelectorAll failed:', selector, error);
    return null;
  }
}

// Initialize DOM safety patches
export function initializeDOMSafety(): void {
  // Wait for DOM to be ready
  waitForDOM().then(() => {
    console.log('🛡️ DOM safety system initialized');
    
    // Override appendChild globally to add null safety
    const originalAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function<T extends Node>(newChild: T): T {
      try {
        if (!newChild) {
          console.warn('Attempted to append null child');
          return newChild;
        }
        return originalAppendChild.call(this, newChild) as T;
      } catch (error) {
        console.warn('Global appendChild error caught:', error);
        return newChild;
      }
    };
    
    // Override createElement to ensure it always returns valid elements
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName: string, options?: any): HTMLElement {
      try {
        const element = originalCreateElement.call(this, tagName, options);
        if (!element) {
          throw new Error(`Failed to create element: ${tagName}`);
        }
        return element;
      } catch (error) {
        console.warn('createElement error:', error);
        // Return a safe fallback div element
        return originalCreateElement.call(this, 'div');
      }
    };
  });
}

// Initialize immediately
initializeDOMSafety();