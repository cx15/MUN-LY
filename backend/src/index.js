export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    try {
      if (path === '/api/submit-conference' && request.method === 'POST') {
        return await handleConferenceSubmission(request, env);
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  try {
    // Get user ID from headers
    const userId = request.headers.get('X-Encrypted-Yw-ID');
    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'User authentication required' 
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

    // Save to database
    const stmt = env.DB.prepare(`
      INSERT INTO conference_submissions 
      (conference_name, organizing_institution, city, contact_email, start_date, end_date, description, encrypted_yw_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.bind(
      data.conferenceName.trim(),
      data.organizingInstitution.trim(),
      data.city.trim(),
      data.contactEmail.trim(),
      data.startDate.trim(),
      data.endDate.trim(),
      data.description.trim(),
      userId
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

async function sendEmailNotification(data, env) {
  try {
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

    // Use FormSubmit - a reliable, free email service
    const emailResponse = await fetch('https://formsubmit.co/ajax/danaa.elaref@gmail.com', {
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