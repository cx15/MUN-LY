
const CONFIG = {
  API_BASE_URL: 'https://munly-backend-independent.munly-backend.workers.dev',
  
  
  ENDPOINTS: {
    SUBMIT_CONFERENCE: '/api/submit-conference',
    GET_CONFERENCES: '/api/conferences',
    DELETE_CONFERENCE: '/api/conferences',
    HEALTH_CHECK: '/api/health',
    SIGNUP: '/api/auth/signup',
    SIGNIN: '/api/auth/signin',
    ME: '/api/auth/me'
  },
  
  API_KEY: null,
  
  CONTACT: {
    email: 'info@yourdomain.com',
    whatsapp: '+218 XXX XXX XXXX',
    instagram: '@your_instagram',
    facebook: 'Your Facebook Page'
  },
  
  SITE: {
    name: 'MUNLY',
    domain: 'yourdomain.com',
    description: 'Libya\'s Premier MUN Platform'
  }
};

function getApiUrl(endpoint) {
  return CONFIG.API_BASE_URL + CONFIG.ENDPOINTS[endpoint];
}

function getApiHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (CONFIG.API_KEY) {
    headers['X-API-Key'] = CONFIG.API_KEY;
  }
  
  return headers;
}

if (typeof window !== 'undefined') {
  window.MUNLY_CONFIG = CONFIG;
  window.getApiUrl = getApiUrl;
  window.getApiHeaders = getApiHeaders;
}