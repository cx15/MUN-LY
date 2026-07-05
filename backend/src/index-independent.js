export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Add CORS headers to all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
    };

    try {
      // API Routes
      if (path === '/api/submit-conference' && request.method === 'POST') {
        return await handleConferenceSubmission(request, env);
      }

      if (path === '/api/conferences' && request.method === 'GET') {
        return await getConferences(request, env);
      }

      if (path === '/api/conferences' && request.method === 'DELETE') {
        return await deleteConference(request, env);
      }

      if (path === '/api/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

async function handleConferenceSubmission(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  };

  try {
    // Simple API key authentication (optional)
    const apiKey = request.headers.get('X-API-Key');
    if (env.API_KEY && apiKey !== env.API_KEY) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized access' 
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Parse form data
    const data = await request.json();
    
    // Validate required fields
    const requiredFields = [
      'conferenceName', 'organizingInstitution', 'city', 
      'contactEmail', 'startDate', 'endDate', 'description'
    ];
    
    for (const field of requiredFields) {
      if (!data[field] || data[field].trim() === '') {
        return new Response(JSON.stringify({ 
          error: `Missing required field: ${field}` 
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.contactEmail)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid email format' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (startDate >= endDate) {
      return new Response(JSON.stringify({ 
        error: 'End date must be after start date' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Save to database
    const stmt = env.DB.prepare(`
      INSERT INTO conference_submissions 
      (conference_name, organizing_institution, city, contact_email, start_date, end_date, description, submitted_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.bind(
      data.conferenceName.trim(),
      data.organizingInstitution.trim(),
      data.city.trim(),
      data.contactEmail.trim(),
      data.startDate.trim(),
      data.endDate.trim(),
      data.description.trim(),
      new Date().toISOString(),
      'pending'
    ).run();

    // Send email notification
    await sendEmailNotification(data, env);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Conference submission received successfully',
      id: result.meta.last_row_id
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Conference submission error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to submit conference',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function getConferences(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  };

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    let query = 'SELECT * FROM conference_submissions';
    let params = [];

    if (status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY submitted_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = env.DB.prepare(query);
    const result = await stmt.bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      conferences: result.results,
      total: result.results.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Get conferences error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch conferences',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function deleteConference(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  };

  try {
    // Require API key for deletion
    const apiKey = request.headers.get('X-API-Key');
    if (!env.ADMIN_API_KEY || apiKey !== env.ADMIN_API_KEY) {
      return new Response(JSON.stringify({ 
        error: 'Admin access required' 
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ 
        error: 'Conference ID required' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const stmt = env.DB.prepare('DELETE FROM conference_submissions WHERE id = ?');
    const result = await stmt.bind(id).run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ 
        error: 'Conference not found' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Conference deleted successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Delete conference error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete conference',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function sendEmailNotification(data, env) {
  try {
    // Skip email if no notification email is configured
    if (!env.NOTIFICATION_EMAIL) {
      console.log('No notification email configured, skipping email notification');
      return;
    }

    // Create email content
    const emailSubject = `New Conference Submission - ${data.conferenceName}`;
    const emailBody = `
New Conference Submission:

Conference Name: ${data.conferenceName}
Organizing Institution: ${data.organizingInstitution}
City: ${data.city}
Contact Email: ${data.contactEmail}
Start Date: ${data.startDate}
End Date: ${data.endDate}

Description:
${data.description}

Please review this conference submission for inclusion on MUNLY.

Submitted at: ${new Date().toISOString()}
    `.trim();

    // Use FormSubmit or configure your own email service
    const emailResponse = await fetch(`https://formsubmit.co/ajax/${env.NOTIFICATION_EMAIL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        subject: emailSubject,
        message: emailBody,
        _captcha: 'false',
        _template: 'basic'
      })
    });

    if (emailResponse.ok) {
      console.log('Email notification sent successfully');
    } else {
      console.error('Failed to send email notification');
    }

  } catch (error) {
    console.error('Email notification error:', error);
    // Don't throw error here - conference submission should still succeed
  }
}