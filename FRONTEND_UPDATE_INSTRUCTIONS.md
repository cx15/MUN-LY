# Frontend Update Instructions for Independent Backend

This guide will help you update the MUNLY frontend to work with your independent backend infrastructure.

## Quick Start

1. **Update Configuration**: Modify `frontend-config.js` with your backend URL and contact information
2. **Update Contact Information**: Replace placeholder contact details throughout the site
3. **Test API Integration**: Verify that form submissions work with your new backend

## Step 1: Configure Backend URL

Open `frontend-config.js` and update:

```javascript
const CONFIG = {
  // Replace with your deployed worker URL
  API_BASE_URL: 'https://your-worker-name.your-subdomain.workers.dev',
  
  // Or use your custom domain
  // API_BASE_URL: 'https://api.yourdomain.com',
  
  // Update contact information
  CONTACT: {
    email: 'info@yourdomain.com',
    whatsapp: '+218 XXX XXX XXXX',
    instagram: '@your_instagram',
    facebook: 'Your Facebook Page'
  },
  
  // Update site information
  SITE: {
    name: 'MUNLY',
    domain: 'yourdomain.com',
    description: 'Libya\'s Premier MUN Platform'
  }
};
```

## Step 2: Update Contact Information in HTML

The main contact information needs to be updated in these sections:

### Contact Section (around line 1498)
Replace the hardcoded contact methods:

```html
<!-- Replace info@mun.ly with your email -->
<div class="contact-method" onclick="openEmail('your-email@domain.com')">
    <div class="contact-method-content">
        <h4>Email Us</h4>
        <p>your-email@domain.com</p>
    </div>
</div>

<!-- Replace +218944962446 with your WhatsApp -->
<div class="contact-method" onclick="openWhatsApp('+218XXXXXXXXX')">
    <div class="contact-method-content">
        <h4>WhatsApp</h4>
        <p>+218 XXX XXX XXXX</p>
    </div>
</div>

<!-- Replace modelunly with your Instagram -->
<div class="contact-method" onclick="openInstagram('your_instagram')">
    <div class="contact-method-content">
        <h4>Instagram</h4>
        <p>@your_instagram</p>
    </div>
</div>
```

### Footer Section (around line 1650)
Update footer contact information:

```html
<div class="footer-section">
    <h3>Contact Info</h3>
    <ul class="footer-links">
        <li><i class="fas fa-envelope"></i> your-email@domain.com</li>
        <li><i class="fab fa-whatsapp"></i> +218 XXX XXX XXXX</li>
        <li><i class="fab fa-instagram"></i> @your_instagram</li>
        <li><i class="fab fa-facebook"></i> Your Facebook Page</li>
        <li><i class="fas fa-map-marker-alt"></i> Libya</li>
    </ul>
</div>
```

## Step 3: Verify API Integration

The form submission code has been updated to use the configuration:

```javascript
// This now uses your configured backend URL
const response = await fetch(getApiUrl('SUBMIT_CONFERENCE'), {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(conferenceData)
});
```

## Step 4: Test the Integration

1. **Deploy your backend** following the instructions in `backend/DEPLOYMENT.md`
2. **Update frontend configuration** with your deployed backend URL
3. **Test form submission** by submitting a test conference
4. **Check database** to verify data is being stored
5. **Test email notifications** if configured

## Step 5: Optional Enhancements

### Add API Health Check

Add this JavaScript function to monitor your backend health:

```javascript
async function checkBackendHealth() {
    try {
        const response = await fetch(getApiUrl('HEALTH_CHECK'));
        const data = await response.json();
        console.log('Backend health:', data);
        return data.status === 'ok';
    } catch (error) {
        console.error('Backend health check failed:', error);
        return false;
    }
}
```

### Add Loading States

Enhance the form with better loading indicators:

```javascript
// Show loading state
submitButton.textContent = 'Submitting...';
submitButton.disabled = true;

// Add loading class for styling
submitButton.classList.add('loading');

// Reset after submission
submitButton.textContent = 'Submit Conference';
submitButton.disabled = false;
submitButton.classList.remove('loading');
```

### Add Error Handling

Improve error handling for better user experience:

```javascript
try {
    const response = await fetch(getApiUrl('SUBMIT_CONFERENCE'), {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(conferenceData)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Submission failed');
    }

    const result = await response.json();
    // Show success message
    
} catch (error) {
    console.error('Submission error:', error);
    // Show user-friendly error message
    alert(`Submission failed: ${error.message}`);
}
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: 
   - Verify your backend CORS configuration allows your domain
   - Check that your frontend domain matches the CORS settings

2. **API Key Issues**:
   - Ensure API_KEY in frontend-config.js matches your backend
   - Check that the X-API-Key header is being sent

3. **Form Submission Fails**:
   - Check browser console for detailed error messages
   - Verify your backend URL is correct and accessible
   - Test your backend health endpoint directly

### Debug Steps

1. **Check Configuration**:
   ```javascript
   console.log('API Base URL:', MUNLY_CONFIG.API_BASE_URL);
   console.log('Submit URL:', getApiUrl('SUBMIT_CONFERENCE'));
   ```

2. **Test Backend Direct**:
   ```bash
   curl -X GET https://your-backend-url/api/health
   ```

3. **Check Network Tab**:
   - Open browser Developer Tools
   - Go to Network tab
   - Submit form and check request/response details

## Complete Migration Checklist

- [ ] Backend deployed and accessible
- [ ] Frontend configuration updated with backend URL
- [ ] Contact information updated throughout site
- [ ] Form submission tested successfully
- [ ] Email notifications working (if configured)
- [ ] All external links updated to your domain
- [ ] Social media links updated
- [ ] Error handling improved
- [ ] Loading states implemented
- [ ] HTTPS configuration verified
- [ ] Custom domain configured (if using)

After completing these steps, your MUNLY website will be fully independent of Youware infrastructure and ready for production use with your own backend services.