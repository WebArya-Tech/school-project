import config from '../config/config.js';

/**
 * Security utilities for production environment
 */

// Disable console logs in production
export const initializeSecurityMeasures = () => {
  if (config.IS_PRODUCTION && !config.ENABLE_CONSOLE_LOGS) {
    // Disable console methods in production
    const noop = () => { };
    console.log = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    // Keep console.error for critical issues
  }

  // Disable React DevTools in production
  if (config.IS_PRODUCTION && !config.ENABLE_DEVTOOLS) {
    if (typeof window !== 'undefined' && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = null;
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberUnmount = null;
    }
  }

  // Disable right-click context menu in production (optional)
  if (config.IS_PRODUCTION) {
    document.addEventListener('contextmenu', (e) => {
      if (!config.ENABLE_DEBUG) {
        e.preventDefault();
      }
    });

    // Disable F12, Ctrl+Shift+I, Ctrl+U (optional - can be aggressive)
    document.addEventListener('keydown', (e) => {
      if (!config.ENABLE_DEBUG) {
        if (
          e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.key === 'U')
        ) {
          e.preventDefault();
        }
      }
    });
  }
};

// Sanitize user input to prevent XSS
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Validate and sanitize form data
export const sanitizeFormData = (formData) => {
  const sanitized = {};

  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value.trim());
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeInput(item.trim()) : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

// Generate secure headers for API requests
export const getSecureHeaders = (additionalHeaders = {}) => {
  const baseHeaders = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  // Add CSRF token if available
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (csrfToken) {
    baseHeaders['X-CSRF-Token'] = csrfToken;
  }

  return { ...baseHeaders, ...additionalHeaders };
};

// Rate limiting utility
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(identifier) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }

    const userRequests = this.requests.get(identifier);

    // Remove old requests outside the window
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
    this.requests.set(identifier, validRequests);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    return true;
  }
}

export const apiRateLimiter = new RateLimiter(100, 60000); // 50 requests per minute

// Secure local storage wrapper
export const secureStorage = {
  setItem: (key, value) => {
    try {
      const serializedValue = JSON.stringify({
        value,
        timestamp: Date.now(),
        checksum: btoa(JSON.stringify(value)) // Simple integrity check
      });
      localStorage.setItem(key, serializedValue);
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  },

  getItem: (key, maxAge = 24 * 60 * 60 * 1000) => { // Default 24 hours
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const parsed = JSON.parse(item);
      const now = Date.now();

      // Check if item has expired
      if (now - parsed.timestamp > maxAge) {
        localStorage.removeItem(key);
        return null;
      }

      // Verify integrity
      const expectedChecksum = btoa(JSON.stringify(parsed.value));
      if (parsed.checksum !== expectedChecksum) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed.value;
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return null;
    }
  },

  removeItem: (key) => {
    localStorage.removeItem(key);
  },

  clear: () => {
    localStorage.clear();
  }
};

// Environment-specific error reporting
export const reportError = (error, context = {}) => {
  if (config.ENABLE_ERROR_REPORTING && config.SENTRY_DSN) {
    // In a real app, you would integrate with Sentry or similar service
    console.error('Error reported:', error, context);

    // Example Sentry integration:
    // Sentry.captureException(error, { extra: context });
  } else if (config.IS_DEVELOPMENT) {
    console.error('Development Error:', error, context);
  }
};

// Content Security Policy helpers
export const generateCSPNonce = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, array));
};

// Initialize security measures when module loads
if (typeof window !== 'undefined') {
  initializeSecurityMeasures();
}