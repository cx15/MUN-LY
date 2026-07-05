# MUNLY Independent Backend Deployment Guide

This guide will help you deploy the MUNLY backend infrastructure independently without relying on Youware services.

## Prerequisites

1. **Cloudflare Account**: Free tier is sufficient for small-medium traffic
2. **Node.js**: Version 18 or higher
3. **npm or yarn**: For package management
4. **Wrangler CLI**: Cloudflare's CLI tool

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
npm install -g wrangler
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Create D1 Database

```bash
# Create the database
wrangler d1 create munly-database

# Copy the database ID from the output and update wrangler-independent.toml
# Replace the database_id field in the [[d1_databases]] section
```

### 4. Initialize Database Schema

```bash
# Apply the schema
wrangler d1 execute munly-database --file=schema-independent.sql
```

### 5. Configure Environment Variables

Set up your environment secrets:

```bash
# Optional: API key for form submission protection
wrangler secret put API_KEY

# Admin API key for conference management
wrangler secret put ADMIN_API_KEY

# Email for notifications (FormSubmit compatible)
wrangler secret put NOTIFICATION_EMAIL
```

### 6. Update Configuration

1. Copy `wrangler-independent.toml` to `wrangler.toml`
2. Update the `database_id` with your D1 database ID
3. Optionally add custom domain routes

### 7. Deploy

```bash
# Test deployment
wrangler deploy --dry-run

# Deploy to production
wrangler deploy
```

## Configuration Options

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | No | Optional API key for form submission protection |
| `ADMIN_API_KEY` | Yes | Required for admin operations (conference deletion) |
| `NOTIFICATION_EMAIL` | No | Email address for conference submission notifications |

### Database Configuration

The independent schema includes:
- Conference submissions with status tracking
- Optional admin users table
- Application settings
- Audit logging

### Custom Domain (Optional)

1. Add your domain to Cloudflare
2. Update `wrangler.toml` with routes:
   ```toml
   routes = [
     { pattern = "api.yourdomain.com", custom_domain = true }
   ]
   ```

## API Endpoints

Your deployed backend will provide these endpoints:

### Conference Management
- `POST /api/submit-conference` - Submit new conference
- `GET /api/conferences` - List conferences (with optional status filter)
- `DELETE /api/conferences?id=X` - Delete conference (requires admin API key)

### System
- `GET /api/health` - Health check endpoint

## Frontend Integration

Update your frontend JavaScript to use the new backend URL:

```javascript
// Replace backend.youware.com with your deployed worker URL
const API_BASE_URL = 'https://munly-backend-independent.your-subdomain.workers.dev';

// Or use your custom domain
const API_BASE_URL = 'https://api.yourdomain.com';
```

## Database Management

### View Conference Submissions

```bash
# List all submissions
wrangler d1 execute munly-database --command="SELECT * FROM conference_submissions ORDER BY submitted_at DESC LIMIT 10;"

# Filter by status
wrangler d1 execute munly-database --command="SELECT * FROM conference_submissions WHERE status = 'pending';"
```

### Update Conference Status

```bash
# Approve a conference
wrangler d1 execute munly-database --command="UPDATE conference_submissions SET status = 'approved' WHERE id = 1;"

# Reject a conference
wrangler d1 execute munly-database --command="UPDATE conference_submissions SET status = 'rejected' WHERE id = 1;"
```

### Backup Database

```bash
# Export database
wrangler d1 export munly-database --output=backup.sql
```

## Monitoring and Logs

### View Logs

```bash
# Real-time logs
wrangler tail

# Recent logs
wrangler tail --since 1h
```

### Analytics

Monitor your worker's performance in the Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select your worker
3. View analytics and logs

## Cost Estimation

**Cloudflare Workers Free Tier:**
- 100,000 requests/day
- 10ms CPU time per request
- 1GB outbound data transfer

**D1 Database Free Tier:**
- 5 million row reads/month
- 100,000 row writes/month
- 5GB storage

This is sufficient for most small-medium MUN conference websites.

## Troubleshooting

### Common Issues

1. **Database not found**: Ensure database_id in wrangler.toml is correct
2. **CORS errors**: Check that your frontend domain is properly configured
3. **Authentication failures**: Verify API keys are set correctly

### Debug Commands

```bash
# Check current secrets
wrangler secret list

# Validate wrangler.toml
wrangler deploy --dry-run

# Test database connection
wrangler d1 execute munly-database --command="SELECT 1;"
```

## Security Best Practices

1. **Use strong API keys**: Generate random, long API keys
2. **Limit CORS origins**: In production, replace '*' with specific domains
3. **Enable rate limiting**: Consider adding rate limiting for form submissions
4. **Monitor access logs**: Regular review of worker analytics
5. **Regular backups**: Schedule regular database exports

## Migration from Youware Backend

If migrating from existing Youware backend:

1. Export existing data from Youware dashboard
2. Transform data format to match new schema
3. Import using D1 SQL commands
4. Update frontend API endpoints
5. Test all functionality before switching DNS

## Support

For deployment issues:
- Check Cloudflare Workers documentation
- Review wrangler CLI documentation
- Verify your Cloudflare account limits

For application-specific issues:
- Check worker logs via `wrangler tail`
- Test API endpoints directly
- Verify database schema and data