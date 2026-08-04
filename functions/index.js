const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

exports.generateConferenceDetailPage = onDocumentWritten('conferences/{docId}', async (event) => {
    const docId = event.params.docId;
    const newData = event.data.after.data();

    if (!newData || !newData.approved) {
        console.log(`Conference ${docId} is not approved. Skipping.`);
        return null;
    }

    try {
        const html = generateHTML(newData);
        const fileName = `conferences/${docId}.html`;
        const file = bucket.file(fileName);

        await file.save(html, {
            metadata: {
                contentType: 'text/html',
                cacheControl: 'public, max-age=300',
            },
        });

        const { v4: uuidv4 } = require('uuid');
        const token = uuidv4();

        await file.save(html, {
            metadata: {
                contentType: 'text/html',
                cacheControl: 'no-cache',
                metadata: {
                    firebaseStorageDownloadTokens: token
                }
            },
        });

        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;
        await db.collection('conferences').doc(docId).update({
            detailPageUrl: publicUrl,
            pageGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Generated page for ${docId}`);
        return { success: true, url: publicUrl };
    } catch (error) {
        console.error(`Error for ${docId}:`, error);
        throw error;
    }
});

exports.notifyNewConference = onDocumentWritten('conferences/{docId}', async (event) => {
    const docId = event.params.docId;
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    // Only trigger on NEW conference creation (not updates)
    if (oldData || !newData) return null;

    try {
        await db.collection('mail').add({
            to: 'info@mun.ly',
            message: {
                subject: `New Conference Submission: ${newData.name || 'Unnamed'}`,
                html: `
                    <h2>New Conference Submitted on MUNLY</h2>
                    <p><strong>Conference Name:</strong> ${newData.name || 'N/A'}</p>
                    <p><strong>Institution:</strong> ${newData.institution || 'N/A'}</p>
                    <p><strong>Venue:</strong> ${newData.venue || 'N/A'}</p>
                    <p><strong>Contact Email:</strong> ${newData.contactEmail || 'N/A'}</p>
                    <p><strong>Submitted at:</strong> ${new Date().toLocaleString()}</p>
                    <br>
                    <a href="https://console.firebase.google.com/project/munly-2b1b4/firestore/data/conferences/${docId}" 
                       style="background:#1e40af;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
                        Review in Firebase Console
                    </a>
                `
            }
        });
        console.log(`Notification email sent for conference ${docId}`);
        return null;
    } catch (error) {
        console.error('Error sending notification:', error);
        throw error;
    }
});

function generateHTML(data) {
    const escape = (text) => {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    // ---- Date handling ----
    const toDateObj = (d) => (d ? (d.toDate ? d.toDate() : new Date(d)) : null);
    const startD = toDateObj(data.startDate);
    const endD = toDateObj(data.endDate);

    const formatDateRange = (start, end) => {
        if (!start) return 'TBA';
        const month = start.toLocaleDateString('en-US', { month: 'long' });
        const year = start.getFullYear();
        const startDay = start.getDate();
        if (!end || start.toDateString() === end.toDateString()) {
            return `${month} ${startDay}, ${year}`;
        }
        const endMonth = end.toLocaleDateString('en-US', { month: 'long' });
        const endDay = end.getDate();
        if (month === endMonth) {
            return `${month} ${startDay}-${endDay}, ${year}`;
        }
        return `${month} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    };
    const dateRangeStr = formatDateRange(startD, endD);

    let countdownTarget = startD ? startD.toISOString() : '';

    if (startD && data.schedule && data.schedule.length > 0) {
        const firstDay = data.schedule[0];
        if (firstDay.sessions && firstDay.sessions.length > 0) {
            const firstTime = firstDay.sessions[0].time; // e.g. "9:00 AM"
            if (firstTime) {
                const target = new Date(startD);
                const timeParts = firstTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                if (timeParts) {
                    let hours = parseInt(timeParts[1]);
                    const minutes = parseInt(timeParts[2]);
                    const period = timeParts[3];
                    if (period) {
                        if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                        if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
                    }
                    target.setHours(hours, minutes, 0, 0);
                    countdownTarget = target.toISOString();
                }
            }
        }
    }

    const heroStyle = data.heroImage
        ? `background-image: url('${escape(data.heroImage)}'); background-size: cover; background-position: center;`
        : '';

    const committeesCount = data.committeesCount ?? (data.committees ? data.committees.length : 0);
    const teamSize = data.teamSize ?? (data.organizingTeam ? data.organizingTeam.length : 0);
    const expectedParticipants = data.expectedParticipants || 'TBA';
    const daysCount = (startD && endD) ? Math.max(1, Math.round((endD - startD) / 86400000) + 1) : (data.days || 'TBA');

    // ---- Committees section ----
    const committeesHtml = (data.committees || []).length > 0
        ? data.committees.map(c => `
        <div class="committee-card">
          <div class="committee-image"><i class="fas fa-users"></i></div>
          <div class="committee-content">
            <h4 class="committee-title">${escape(c.name)}</h4>
            <p>${escape(c.agenda || '')}</p>
            ${c.level ? `<p><strong>Level:</strong> ${escape(c.level)}</p>` : ''}
          </div>
        </div>
      `).join('')
        : '<p style="text-align:center;">Committees will be announced soon.</p>';

    // ---- Organizing team / chairs section ----
    const teamHtml = (data.organizingTeam || []).length > 0
        ? data.organizingTeam.map(p => `
        <div class="detail-list-row">${escape(p.name)} — ${escape(p.role || '')}${p.school ? ' · ' + escape(p.school) : ''}</div>
      `).join('')
        : '<p>No team members listed yet.</p>';

    const chairsHtml = (data.chairs || []).length > 0
        ? data.chairs.map(p => `
        <div class="detail-list-row">${escape(p.name)} — ${escape(p.role || 'Chair')}</div>
      `).join('')
        : '<p>No chairs listed yet.</p>';

    const scheduleHtml = (data.schedule || []).length > 0
        ? data.schedule.map(d => `
        <div style="margin-bottom: 2rem;">
          <h4 style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 0.75rem 1.25rem; border-radius: 0.5rem; margin-bottom: 0.75rem;">
            ${escape(d.day || '')}
          </h4>
          ${(d.sessions || []).map(s => `
            <div style="display:flex; gap:1rem; padding:0.6rem 1rem; border-bottom:1px solid #e2e8f0;">
              <span style="color:#6b7280; min-width:90px; font-size:0.9rem;">${escape(s.time || '')}</span>
              <span>${escape(s.session || '')}</span>
            </div>
          `).join('')}
        </div>
      `).join('')
        : '<p style="text-align:center;">No schedule posted yet.</p>';

    // ---- Status badge (Upcoming / Ongoing / Past Event) ----
    let status = 'Upcoming';
    const now = new Date();
    if (endD && endD < now) status = 'Past Event';
    else if (startD && startD <= now && endD && endD >= now) status = 'Ongoing';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escape(data.name)} | MUNLY</title>
<title>${escape(data.name)} | MUNLY</title>
<link rel="icon" href="https://munly-2b1b4.web.app/Munlylogo3.png" type="image/png">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
<style>
  :root {
    --primary-blue: #1e40af;
    --secondary-blue: #3b82f6;
    --light-blue: #dbeafe;
    --dark-blue: #1e3a8a;
    --accent-blue: #60a5fa;
    --text-dark: #1f2937;
    --text-gray: #6b7280;
    --text-light: #9ca3af;
    --background-white: #ffffff;
    --background-light: #f9fafb;
    --border-light: #e5e5e5;
    --gradient-blue: linear-gradient(135deg, var(--primary-blue), var(--secondary-blue));
    --gradient-light: linear-gradient(135deg, var(--background-light), var(--light-blue));
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
  }
  * { margin:0; padding:0; box-sizing:border-box; font-family:'Playfair Display', serif; }
  html { scroll-behavior: smooth; }
  body { color: var(--text-dark); background: var(--background-light); line-height: 1.6; }
  h1,h2,h3,h4,h5 { font-weight:700; line-height:1.2; }
  h2 { font-size:2.5rem; margin-bottom:1.5rem; }
  h3 { font-size:2rem; margin-bottom:1.25rem; }
  p { color: var(--text-gray); margin-bottom:1rem; }
  a { color: var(--primary-blue); text-decoration:none; }

  nav { position:fixed; top:0; left:0; width:100%; background:white; box-shadow:var(--shadow-sm); z-index:1000; }
  .nav-container { max-width:1200px; margin:0 auto; padding:1rem 1.5rem; display:flex; justify-content:space-between; align-items:center; }
  .logo { font-weight:700; font-size:1.5rem; color:var(--primary-blue); }
  .back-btn { background: var(--light-blue); color: var(--primary-blue); padding: 0.6rem 1.2rem; border-radius: 0.5rem; font-weight:600; border:none; cursor:pointer; }
  .back-btn:hover { background: var(--secondary-blue); color:white; }

  .hero { ${heroStyle} color:white; padding:160px 0 80px; text-align:center; position:relative; overflow:hidden; background-color: var(--primary-blue); }
  .hero::before { content:''; position:absolute; inset:0; background-color:var(--primary-blue); opacity:${data.heroImage ? '0.7' : '0'}; }
  .hero-content { max-width:1200px; margin:0 auto; padding:0 1.5rem; position:relative; z-index:1; }
  .conference-logo { width:80px; height:80px; background:var(--light-blue); color:var(--primary-blue); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:2.5rem; margin:0 auto 2rem; }
  .conference-title { font-size:3.5rem; margin-bottom:0.5rem; }
  .conference-subtitle { font-size:1.5rem; margin-bottom:1.5rem; opacity:0.9; color:white; }
  .conference-date-line { display:inline-flex; align-items:center; gap:0.5rem; margin-bottom:2.5rem; font-size:1.25rem; opacity:0.9; }
  .status-badge { display:inline-block; background:rgba(255,255,255,0.15); padding:0.4rem 1rem; border-radius:2rem; font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:1.5rem; }

  .countdown { margin:2.5rem 0 3rem; }
  .countdown h3 { font-size:1.5rem; margin-bottom:1.5rem; }
  .countdown-timer { display:flex; justify-content:center; gap:1rem; flex-wrap:wrap; }
  .countdown-item { display:flex; flex-direction:column; align-items:center; background:rgba(255,255,255,0.1); border-radius:0.75rem; padding:1rem; min-width:80px; }
  .countdown-number { font-size:2rem; font-weight:700; margin-bottom:0.25rem; }
  .countdown-label { font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; opacity:0.8; }

  section { padding:100px 0; }
  .container { max-width:1200px; margin:0 auto; padding:0 1.5rem; }
  .section-header { text-align:center; margin-bottom:4rem; }
  .section-title { font-size:2.5rem; margin-bottom:1rem; }
  .section-subtitle { font-size:1.25rem; color:var(--text-gray); max-width:800px; margin:0 auto; }

  .about-text h3 { margin-bottom:1.5rem; font-size:1.75rem; }
  .location-info { margin-top:2rem; padding:1.5rem; background:var(--light-blue); border-radius:1rem; border-left:4px solid var(--primary-blue); }
  .location-info h4 { color:var(--primary-blue); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; }
  .location-btn { display:inline-flex; align-items:center; gap:0.5rem; margin-top:1rem; padding:0.75rem 1.5rem; background:var(--primary-blue); color:white; border-radius:0.5rem; font-weight:500; }
  .location-btn:hover { background:var(--dark-blue); }

  .stats-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:2rem; margin:4rem 0; }
  .stat-card { background:white; border-radius:1rem; padding:2rem; text-align:center; box-shadow:var(--shadow-sm); }
  .stat-number { font-size:3rem; font-weight:800; color:var(--primary-blue); margin-bottom:0.5rem; }
  .stat-label { color:var(--text-gray); }

  .committees-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:2rem; }
  .committee-card { background:white; border-radius:1rem; overflow:hidden; box-shadow:var(--shadow-sm); }
  .committee-image { height:140px; background:var(--gradient-blue); display:flex; align-items:center; justify-content:center; font-size:2.5rem; color:white; }
  .committee-content { padding:1.5rem; }
  .committee-title { font-size:1.3rem; margin-bottom:0.75rem; }

  .detail-section { background:white; padding:2rem; border-radius:1rem; box-shadow:var(--shadow-sm); margin-bottom:2rem; }
  .detail-list-row { padding:0.75rem 0; border-bottom:1px solid var(--border-light); }
  .detail-list-row:last-child { border-bottom:none; }

  .cta-button { display:inline-block; background:var(--gradient-blue); color:white; padding:0.9rem 2rem; border-radius:0.5rem; font-weight:600; border:none; cursor:pointer; }
  .cta-button:hover { transform:translateY(-2px); box-shadow:var(--shadow-lg); }

  footer { background:var(--primary-blue); color:white; padding:2rem 0; text-align:center; }
  footer p { color: rgba(255,255,255,0.85); margin: 0; }

  @media (max-width:768px) {
    .conference-title { font-size:2.5rem; }
    .stats-grid, .committees-grid { grid-template-columns:1fr; }
  }
</style>
</head>
<body>
  <nav>
    <div class="nav-container">
      <a href="https://munly-2b1b4.web.app" class="logo">MUNLY</a>
      <button class="back-btn" onclick="window.history.back()"><i class="fas fa-arrow-left"></i> Back</button>
    </div>
  </nav>

  <!-- Hero -->
  <section class="hero">
    <div class="hero-content">
      <div class="conference-logo">
          ${data.logoImage
            ? `<img src="${escape(data.logoImage)}" alt="${escape(data.name)} logo" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
            : `<i class="fas fa-globe"></i>`}
      </div>
      <div class="status-badge">${status}</div>
      <h1 class="conference-title">${escape(data.name)}</h1>
      <p class="conference-subtitle">${escape(data.institution || '')}</p>
      <div class="conference-date-line">
        <i class="fas fa-calendar-alt"></i> ${dateRangeStr}${data.venue ? ' | ' + escape(data.venue) : ''}
      </div>

      <div class="countdown">
        <h3>Conference Starts In</h3>
        <div class="countdown-timer" id="countdown">
          <div class="countdown-item"><span class="countdown-number" id="days">0</span><span class="countdown-label">Days</span></div>
          <div class="countdown-item"><span class="countdown-number" id="hours">0</span><span class="countdown-label">Hours</span></div>
          <div class="countdown-item"><span class="countdown-number" id="minutes">0</span><span class="countdown-label">Minutes</span></div>
          <div class="countdown-item"><span class="countdown-number" id="seconds">0</span><span class="countdown-label">Seconds</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- About -->
  <section id="about">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">About ${escape(data.name)}</h2>
        ${data.tagline ? `<p class="section-subtitle">${escape(data.tagline)}</p>` : ''}
      </div>

      <div class="about-text">
        ${data.description ? `<p>${escape(data.description)}</p>` : '<p>Conference details will be updated soon.</p>'}

        <div class="location-info">
          <h4><i class="fas fa-map-marker-alt"></i> Conference Location</h4>
          <p><strong>${escape(data.venue || 'TBA')}</strong></p>
          ${data.mapsUrl ? `<a href="${escape(data.mapsUrl)}" target="_blank" class="location-btn"><i class="fas fa-external-link-alt"></i> View on Google Maps</a>` : ''}
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number">${escape(String(expectedParticipants))}</div><div class="stat-label">Expected Participants</div></div>
        <div class="stat-card"><div class="stat-number">${escape(String(daysCount))}</div><div class="stat-label">Conference Days</div></div>
        <div class="stat-card"><div class="stat-number">${committeesCount}</div><div class="stat-label">Committees</div></div>
        <div class="stat-card"><div class="stat-number">${teamSize}</div><div class="stat-label">Team Members</div></div>
      </div>
    </div>
  </section>

  <!-- Committees -->
  <section id="committees" style="background: var(--background-light);">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">Committees</h2>
      </div>
      <div class="committees-grid">
        ${committeesHtml}
      </div>
    </div>
  </section>
  
  <!-- Schedule -->
<section id="schedule" style="background: var(--background-light);">
  <div class="container">
    <div class="section-header">
      <h2 class="section-title">Schedule</h2>
    </div>
    <div class="detail-section">
      ${scheduleHtml}
    </div>
  </div>
</section>

  <!-- Team & Chairs -->
  <section id="team">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">Meet the Team</h2>
      </div>
      <div class="detail-section">
        <h3>Organizing Team</h3>
        ${teamHtml}
      </div>
      <div class="detail-section">
        <h3>Chairs & Moderators</h3>
        ${chairsHtml}
      </div>
    </div>
  </section>

  <!-- Contact / Apply -->
  <section id="apply" style="background: var(--background-light);">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">Get Involved</h2>
        <p class="section-subtitle">Interested in ${escape(data.name)}? Reach out to the organizing team.</p>
      </div>
      <div class="detail-section" style="text-align:center;">
    ${(() => {
        const links = data.applicationLinks || (data.applicationUrl ? [{ label: 'Apply Now', url: data.applicationUrl }] : []);
        if (!links.length) return '';
        const linksJson = JSON.stringify(links).replace(/'/g, "\\'");
        return `
        <div style="position:relative;display:inline-block;margin-bottom:1.5rem;">
            <button onclick="toggleApplyDropdown()" class="cta-button" style="display:flex;align-items:center;gap:0.5rem;">
                Apply Now <span id="applyArrow" style="font-size:0.75rem;">▼</span>
            </button>
            <div id="applyDropdown" style="display:none;position:absolute;top:110%;left:0;min-width:220px;background:white;border-radius:0.5rem;box-shadow:0 8px 30px rgba(0,0,0,0.15);overflow:hidden;z-index:999;">
                ${links.map(l => `<a href="${l.url}" target="_blank" style="display:block;padding:0.75rem 1.25rem;color:#1a73e8;text-decoration:none;font-weight:500;border-bottom:1px solid #f0f0f0;" onmouseover="this.style.background='#f5f8ff'" onmouseout="this.style.background=''">${l.label || 'Apply Now'}</a>`).join('')}
            </div>
        </div>
        <script>
        function toggleApplyDropdown() {
            const d = document.getElementById('applyDropdown');
            const arrow = document.getElementById('applyArrow');
            const open = d.style.display === 'block';
            d.style.display = open ? 'none' : 'block';
            arrow.textContent = open ? '▼' : '▲';
        }
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#applyDropdown') && !e.target.closest('button[onclick="toggleApplyDropdown()"]')) {
                document.getElementById('applyDropdown').style.display = 'none';
                document.getElementById('applyArrow').textContent = '▼';
            }
        });
        <\/script>
    `;
    })()}
        <p><strong>Contact:</strong> <a href="mailto:${escape(data.contactEmail || '')}">${escape(data.contactEmail || '')}</a></p>
        ${data.contactPhone ? `<p><strong>Phone:</strong> ${escape(data.contactPhone)}</p>` : ''}
      </div>
    </div>
  </section>

  <footer>
    <div class="container">
      <p>&copy; ${startD ? startD.getFullYear() : new Date().getFullYear()} ${escape(data.name)}. Organized by MUNLY. All rights reserved.</p>
    </div>
  </footer>

  <script>
    function updateCountdown() {
      const targetDate = new Date('${countdownTarget}').getTime();
      const now = new Date().getTime();
      const timeLeft = targetDate - now;

      if (targetDate && timeLeft > 0) {
        const days = Math.floor(timeLeft / 86400000);
        const hours = Math.floor((timeLeft % 86400000) / 3600000);
        const minutes = Math.floor((timeLeft % 3600000) / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        document.getElementById('days').innerText = days;
        document.getElementById('hours').innerText = hours;
        document.getElementById('minutes').innerText = minutes;
        document.getElementById('seconds').innerText = seconds;
      } else {
        document.getElementById('countdown').innerHTML = '<h3>Conference has started!</h3>';
      }
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);
  </script>
</body>
</html>`;
}