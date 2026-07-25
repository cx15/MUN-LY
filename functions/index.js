const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');

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

        await file.makePublic();

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
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

    const formatDate = (d) => {
        if (!d) return 'TBA';
        const date = d.toDate ? d.toDate() : new Date(d);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const start = formatDate(data.startDate);
    const end = formatDate(data.endDate);

    let status = 'Upcoming';
    if (data.endDate) {
        const endD = data.endDate.toDate ? data.endDate.toDate() : new Date(data.endDate);
        if (endD < new Date()) status = 'Past Event';
    }

    const committees = (data.committees || []).length > 0
        ? data.committees.map(c => `<div class="detail-list-row"><strong>${escape(c.name)}</strong> — ${escape(c.agenda || '')}</div>`).join('')
        : '<p>No committees listed yet.</p>';

    const team = (data.organizingTeam || []).length > 0
        ? data.organizingTeam.map(p => `<div class="detail-list-row">${escape(p.name)} — ${escape(p.role || '')}</div>`).join('')
        : '<p>No team members listed yet.</p>';

    const chairs = (data.chairs || []).length > 0
        ? data.chairs.map(p => `<div class="detail-list-row">${escape(p.name)} — ${escape(p.role || 'Chair')}</div>`).join('')
        : '<p>No chairs listed yet.</p>';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(data.name)} | MUNLY</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Playfair Display', serif; color: #1f2937; background: #f8fafc; }
    nav { position: fixed; top: 0; width: 100%; background: white; border-bottom: 1px solid #e2e8f0; z-index: 1000; }
    .nav-container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; display: flex; justify-content: space-between; align-items: center; height: 70px; }
    .logo { font-size: 2rem; font-weight: 700; color: #1e40af; text-decoration: none; }
    .back-btn { background: #dbeafe; color: #1e40af; padding: 0.5rem 1rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; border: none; cursor: pointer; }
    .back-btn:hover { background: #3b82f6; color: white; }
    .container { max-width: 900px; margin: 0 auto; padding: 100px 1.5rem 3rem; }
    .detail-header { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
    .detail-header h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    .status-badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 0.4rem 0.8rem; border-radius: 2rem; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; }
    .detail-meta { display: flex; gap: 2rem; color: #6b7280; margin-bottom: 1rem; font-family: 'Inter', sans-serif; font-size: 0.95rem; }
    .detail-section { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
    .detail-section h2 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #1e40af; border-bottom: 2px solid #dbeafe; padding-bottom: 0.75rem; }
    .detail-list-row { padding: 0.75rem 0; border-bottom: 1px solid #e2e8f0; font-family: 'Inter', sans-serif; font-size: 0.95rem; }
    .detail-list-row:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <nav>
    <div class="nav-container">
      <a href="index.html" class="logo">MUNLY</a>
      <button class="back-btn" onclick="window.history.back()"><i class="fas fa-arrow-left"></i> Back</button>
    </div>
  </nav>

  <div class="container">
    <div class="detail-header">
      <span class="status-badge">${status}</span>
      <h1>${escape(data.name)}</h1>
      <div class="detail-meta">
        <div><i class="fas fa-map-marker-alt"></i> ${escape(data.venue || 'TBA')}</div>
        <div><i class="fas fa-calendar"></i> ${start}${end !== start ? ' – ' + end : ''}</div>
      </div>
    </div>

    <div class="detail-section">
      <h2>About</h2>
      ${data.institution ? '<p><strong>Institution:</strong> ' + escape(data.institution) + '</p>' : ''}
      ${data.languages ? '<p><strong>Languages:</strong> ' + escape(data.languages) + '</p>' : ''}
    </div>

    <div class="detail-section">
      <h2>Committees</h2>
      ${committees}
    </div>

    <div class="detail-section">
      <h2>Organizing Team</h2>
      ${team}
    </div>

    <div class="detail-section">
      <h2>Chairs</h2>
      ${chairs}
    </div>

    <div class="detail-section">
      <h2>Contact</h2>
      <p><strong>Email:</strong> <a href="mailto:${escape(data.contactEmail || '')}">${escape(data.contactEmail || '')}</a></p>
    </div>
  </div>
</body>
</html>`;
}