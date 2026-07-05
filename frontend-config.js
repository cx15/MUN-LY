// MUNLY Frontend Configuration
// Update this file with your independent backend configuration

const CONFIG = {
  // Backend API Configuration
  API_BASE_URL: 'https://munly-backend-independent.your-subdomain.workers.dev',
  
  // Alternative: Use your custom domain
  // API_BASE_URL: 'https://api.yourdomain.com',
  
  // API endpoints
  ENDPOINTS: {
    SUBMIT_CONFERENCE: '/api/submit-conference',
    GET_CONFERENCES: '/api/conferences',
    DELETE_CONFERENCE: '/api/conferences',
    HEALTH_CHECK: '/api/health'
  },
  
  // Optional: API key for protected endpoints
  API_KEY: null, // Set this if you configured API_KEY in your backend
  
  // Contact Information (update these with your details)
  CONTACT: {
    email: 'info@yourdomain.com',
    whatsapp: '+218 XXX XXX XXXX',
    instagram: '@your_instagram',
    facebook: 'Your Facebook Page'
  },
  
  // Site Configuration
  SITE: {
    name: 'MUNLY',
    domain: 'yourdomain.com',
    description: 'Libya\'s Premier MUN Platform'
  }
};

// Helper function to get full API URL
function getApiUrl(endpoint) {
  return CONFIG.API_BASE_URL + CONFIG.ENDPOINTS[endpoint];
}

// Helper function to get API headers
function getApiHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (CONFIG.API_KEY) {
    headers['X-API-Key'] = CONFIG.API_KEY;
  }
  
  return headers;
}

// Export for use in HTML
if (typeof window !== 'undefined') {
  window.MUNLY_CONFIG = CONFIG;
  window.getApiUrl = getApiUrl;
  window.getApiHeaders = getApiHeaders;
}