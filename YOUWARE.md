# MUNLY - Libya's Premier MUN Platform

## Project Overview
MUNLY is a comprehensive website for Model United Nations conferences in Libya. It serves as the central hub for MUN activities, connecting students, educators, and institutions across the country.

## Key Features & Functionality

### Core Sections
- **Hero Section**: Engaging landing area with statistics and call-to-action buttons
- **Conferences**: Featured MUN conferences with filtering (All, Upcoming, Past, Featured)
- **Add Conference**: Form for organizations to submit new conferences
- **About**: Information about MUNLY's mission and features
- **Resources**: MUN-related documents and tools for delegates and organizers
- **Contact**: Multiple contact methods and conference submission form

### Conference Management
- Three main conferences featured: ISMMUN'24 (past), ISMMUN'25 (recent), SMUMUN 2025 (upcoming)
- Interactive conference cards with detailed information
- Conference filtering system
- Conference detail modals with comprehensive information

### Interactive Elements
- Smooth scrolling navigation
- Conference filtering with animated transitions
- Hover effects and micro-interactions
- Form validation and submission handling
- Mobile-responsive design

## Design System

### Color Palette
```css
--primary-blue: #1e40af
--secondary-blue: #3b82f6
--light-blue: #dbeafe
--dark-blue: #1e3a8a
--accent-blue: #60a5fa
```

### Typography
- **Primary Font**: Inter (body text, UI elements)
- **Display Font**: Playfair Display (headings, logo)

### Layout Structure
- Fixed navigation with scroll effects
- Grid-based responsive layout
- Maximum content width: 1200px
- Consistent spacing using CSS custom properties

## Technical Implementation

### CSS Architecture
- CSS Custom Properties (CSS Variables) for theming
- Grid and Flexbox for layouts
- Intersection Observer API for scroll animations
- Responsive design with mobile-first approach

### JavaScript Features
- Smooth scrolling navigation
- Conference filtering system
- Form handling and validation
- Scroll-triggered animations
- Mobile menu functionality

### Interactive Conference Details
The `showConferenceDetail()` function provides detailed information about each conference including:
- Full conference descriptions
- Committee listings
- Detailed schedules
- Event statistics

## Content Management

### Adding New Conferences
Conferences are currently hardcoded in the HTML. To add new conferences:
1. Add new conference card in the `conferences-grid` section
2. Update the conference data object in the JavaScript
3. Ensure proper `data-category` attributes for filtering

### Updating Conference Information
Conference data is stored in the JavaScript `conferences` object within the `showConferenceDetail()` function.

## Backend Architecture

### Independent Backend Infrastructure
The project includes a complete independent backend solution using Cloudflare Workers:

**Files:**
- `backend/src/index-independent.js` - Independent backend worker code
- `backend/schema-independent.sql` - Database schema without Youware dependencies
- `backend/wrangler-independent.toml` - Cloudflare Workers configuration
- `backend/DEPLOYMENT.md` - Complete deployment guide

**Backend Features:**
- Conference submission API with validation
- Database storage using D1 (SQLite)
- Email notifications via FormSubmit
- CORS-enabled API endpoints
- Optional API key authentication
- Admin conference management endpoints

### Database Schema
**Core Tables:**
- `conference_submissions` - Conference submission data with status tracking
- `admin_users` - Optional admin authentication
- `app_settings` - Configurable application settings
- `audit_log` - Change tracking and audit trail

**Key Features:**
- SQLite STRICT tables for data integrity
- Proper indexing for performance
- Status-based conference workflow (pending/approved/rejected)
- Extensible schema for future enhancements

### API Endpoints
- `POST /api/submit-conference` - Submit new conference
- `GET /api/conferences` - List conferences with filtering
- `DELETE /api/conferences` - Delete conference (admin only)
- `GET /api/health` - Health check endpoint

### Frontend Integration
**Configuration:**
- `frontend-config.js` - Centralized configuration for API endpoints and contact information
- Updated form submission to use independent backend
- Configurable API keys and contact details

**Migration Support:**
- `FRONTEND_UPDATE_INSTRUCTIONS.md` - Step-by-step migration guide
- Backward compatibility during transition
- Testing and troubleshooting procedures

### Deployment Requirements
**Infrastructure:**
- Cloudflare Workers account (free tier sufficient)
- D1 database for data storage
- Optional: Custom domain configuration
- Optional: R2 storage for file uploads

**Environment Variables:**
- `API_KEY` - Optional form submission protection
- `ADMIN_API_KEY` - Required for admin operations
- `NOTIFICATION_EMAIL` - Email for submission notifications

## Responsive Design

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Mobile Optimizations
- Collapsible navigation menu
- Stacked layouts for conference cards
- Adjusted typography scales
- Touch-friendly button sizes

## Maintenance & Updates

### Easy Customization Points
1. **Colors**: Update CSS custom properties in `:root`
2. **Conference Data**: Modify the JavaScript conference objects
3. **Contact Information**: Update footer and contact sections
4. **Resource Links**: Modify the resources section

### Performance Considerations
- Optimized CSS with efficient selectors
- Minimal JavaScript for essential functionality
- External font loading with display=swap
- Lazy loading for future image implementations

## Development Workflow

### File Structure
```
/
├── index.html          # Main website file
└── YOUWARE.md         # This documentation
```

### Making Changes
1. All styling is contained within the `<style>` tag in index.html
2. JavaScript functionality is in the `<script>` tag at the bottom
3. Conference data and content can be updated directly in the HTML

### Testing Checklist
- [ ] All navigation links work correctly
- [ ] Conference filtering functions properly
- [ ] Forms validate and submit correctly
- [ ] Mobile responsiveness across devices
- [ ] Smooth animations and transitions
- [ ] Cross-browser compatibility

## Future Enhancements

### Recommended Additions
1. **Image Integration**: Add actual conference photos and logos
2. **Document System**: Implement downloadable resources
3. **Registration System**: User accounts and conference registration
4. **Calendar Integration**: Event scheduling and reminders
5. **Multi-language Support**: Arabic language option
6. **Admin Panel**: Content management system

### SEO & Accessibility
- Add proper meta tags and Open Graph data
- Implement structured data for events
- Ensure WCAG compliance for accessibility
- Add alt tags for images when implemented

## Contact Integration

The website includes multiple contact methods:
- Email: info@munly.ly
- WhatsApp: +218 XX XXX XXXX
- Telegram: @MUNLibya

Update these placeholders with actual contact information when available.