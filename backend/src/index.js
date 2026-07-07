export default {
  async fetch(request, env, ctx) {
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

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
    };

    try {
      if (path === '/api/submit-conference' && request.method === 'POST') {
        return await handleConferenceSubmission(request, env);
      }

      if (path === '/api/conferences' && request.method === 'GET') {
        return await getConferences(request, env);
      }

      if (path === '/api/conferences' && request.method === 'DELETE') {
        return await deleteConference(request, env);
      }

      if (path === '/api/auth/signup' && request.method === 'POST') {
        return await handleSignUp(request, env);
      }

      if (path === '/api/auth/signin' && request.method === 'POST') {
        return await handleSignIn(request, env);
      }

      if (path === '/api/auth/verify-email' && request.method === 'POST') {
        return await handleVerifyEmail(request, env);
      }

      if (path === '/api/auth/resend-verification' && request.method === 'POST') {
        return await handleResendVerification(request, env);
      }

      if (path === '/api/auth/me' && request.method === 'GET') {
        return await handleMe(request, env);
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

// ==================== UTILITY & CRYPTO FUNCTIONS ====================

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes.buffer;
}

function generateSaltHex() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

function generateVerificationToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

async function derivePasswordHash(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBuf(saltHex), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}

async function hashPassword(password) {
  const salt = generateSaltHex();
  const hash = await derivePasswordHash(password, salt);
  return `${salt}:${hash}`;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const computed = await derivePasswordHash(password, salt);
  return timingSafeEqual(computed, hash);
}

function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function hmacSign(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return base64urlEncode(String.fromCharCode(...new Uint8Array(sig)));
}

async function createToken(payload, secret, expiresInSeconds = 7 * 24 * 60 * 60) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const encHeader = base64urlEncode(JSON.stringify(header));
  const encPayload = base64urlEncode(JSON.stringify(body));
  const data = `${encHeader}.${encPayload}`;
  const sig = await hmacSign(data, secret);
  return `${data}.${sig}`;
}

async function verifyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [encHeader, encPayload, sig] = parts;
  const expectedSig = await hmacSign(`${encHeader}.${encPayload}`, secret);
  if (!timingSafeEqual(sig, expectedSig)) throw new Error('Invalid signature');
  const payload = JSON.parse(base64urlDecode(encPayload));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

async function getAuthUser(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    return await verifyToken(match[1], env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// ==================== HANDLER FUNCTIONS ====================

async function handleConferenceSubmission(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  };

  try {
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

    const data = await request.json();
    
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

async function handleSignUp(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  };
  const jsonHeaders = { 'Content-Type': 'application/json', ...corsHeaders };

  try {
    if (!env.JWT_SECRET) {
      return new Response(JSON.stringify({ error: 'Server misconfigured: JWT_SECRET not set' }), { status: 500, headers: jsonHeaders });
    }

    const data = await request.json();
    const name = (data.name || '').trim();
    const email = (data.email || '').trim().toLowerCase();
    const password = data.password || '';

    if (!name || !email || !password) {
      return new Response(JSON.stringify({ error: 'Name, email, and password are required' }), { status: 400, headers: jsonHeaders });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), { status: 400, headers: jsonHeaders });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), { status: 400, headers: jsonHeaders });
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ error: 'An account with this email already exists' }), { status: 409, headers: jsonHeaders });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    const result = await env.DB.prepare(
      'INSERT INTO users (name, email, password_hash, created_at, last_login) VALUES (?, ?, ?, ?, ?)'
    ).bind(name, email, passwordHash, now, now).run();

    const userId = result.meta.last_row_id;
    const verificationToken = generateVerificationToken();
    await env.DB.prepare('UPDATE users SET verification_token = ? WHERE id = ?').bind(verificationToken, userId).run();

    await sendVerificationEmail(email, name, verificationToken, env);

    return new Response(JSON.stringify({
      success: true,
      message: 'Account created! Check your email to verify your account.',
      token: null,
      user: null,
      requiresVerification: true
    }), { status: 200, headers: jsonHeaders });

  } catch (error) {
    console.error('Signup error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create account', message: error.message }), { status: 500, headers: jsonHeaders });
  }
}

async function handleSignIn(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  };
  const jsonHeaders = { 'Content-Type': 'application/json', ...corsHeaders };

  try {
    if (!env.JWT_SECRET) {
      return new Response(JSON.stringify({ error: 'Server misconfigured: JWT_SECRET not set' }), { status: 500, headers: jsonHeaders });
    }

    const data = await request.json();
    const email = (data.email || '').trim().toLowerCase();
    const password = data.password || '';

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400, headers: jsonHeaders });
    }

    const invalidMsg = 'Invalid email or password';

    const user = await env.DB.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?').bind(email).first();
    if (!user) {
      return new Response(JSON.stringify({ error: invalidMsg }), { status: 401, headers: jsonHeaders });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return new Response(JSON.stringify({ error: invalidMsg }), { status: 401, headers: jsonHeaders });
    }

    await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(new Date().toISOString(), user.id).run();

    const token = await createToken({ sub: user.id, email: user.email, name: user.name }, env.JWT_SECRET);

    return new Response(JSON.stringify({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email }
    }), { status: 200, headers: jsonHeaders });

  } catch (error) {
    console.error('Signin error:', error);
    return new Response(JSON.stringify({ error: 'Failed to sign in', message: error.message }), { status: 500, headers: jsonHeaders });
  }
}

async function handleVerifyEmail(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  };
  const jsonHeaders = { 'Content-Type': 'application/json', ...corsHeaders };

  try {
    const data = await request.json();
    const token = data.token || '';

    if (!token) {
      return new Response(JSON.stringify({ error: 'Verification token required' }), { status: 400, headers: jsonHeaders });
    }

    const user = await env.DB.prepare('SELECT id, email FROM users WHERE verification_token = ? AND verified = 0').bind(token).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired verification token' }), { status: 400, headers: jsonHeaders });
    }

    await env.DB.prepare('UPDATE users SET verified = 1, verification_token = NULL WHERE id = ?').bind(user.id).run();

    const authUser = await env.DB.prepare('SELECT id, name, email FROM users WHERE id = ?').bind(user.id).first();
    const token_jwt = await createToken({ sub: authUser.id, email: authUser.email, name: authUser.name }, env.JWT_SECRET);

    return new Response(JSON.stringify({
      success: true,
      message: 'Email verified successfully',
      token: token_jwt,
      user: authUser
    }), { status: 200, headers: jsonHeaders });

  } catch (error) {
    console.error('Verify email error:', error);
    return new Response(JSON.stringify({ error: 'Failed to verify email', message: error.message }), { status: 500, headers: jsonHeaders });
  }
}

async function handleResendVerification(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  };
  const jsonHeaders = { 'Content-Type': 'application/json', ...corsHeaders };

  try {
    const data = await request.json();
    const email = (data.email || '').trim().toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers: jsonHeaders });
    }

    const user = await env.DB.prepare('SELECT id, name, email, verified FROM users WHERE email = ?').bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: jsonHeaders });
    }

    if (user.verified) {
      return new Response(JSON.stringify({ error: 'Email already verified' }), { status: 400, headers: jsonHeaders });
    }

    const verificationToken = generateVerificationToken();
    await env.DB.prepare('UPDATE users SET verification_token = ? WHERE id = ?').bind(verificationToken, user.id).run();

    await sendVerificationEmail(user.email, user.name, verificationToken, env);

    return new Response(JSON.stringify({
      success: true,
      message: 'Verification email sent'
    }), { status: 200, headers: jsonHeaders });

  } catch (error) {
    console.error('Resend verification error:', error);
    return new Response(JSON.stringify({ error: 'Failed to resend verification', message: error.message }), { status: 500, headers: jsonHeaders });
  }
}

async function handleMe(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  };
  const jsonHeaders = { 'Content-Type': 'application/json', ...corsHeaders };

  const auth = await getAuthUser(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: jsonHeaders });
  }

  const user = await env.DB.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').bind(auth.sub).first();
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: jsonHeaders });
  }

  return new Response(JSON.stringify({ success: true, user }), { status: 200, headers: jsonHeaders });
}

// ==================== EMAIL FUNCTIONS ====================

async function sendVerificationEmail(email, name, token, env) {
  try {
    if (!env.NOTIFICATION_EMAIL) {
      console.log('No notification email configured, skipping verification email');
      return;
    }

    const verifyUrl = `https://yourdomain.com?token=${token}`;
    const emailSubject = 'Verify your MUNLY account';
    const emailBody = `
Hello ${name},

Welcome to MUNLY! Please verify your email address by clicking the link below:

${verifyUrl}

This link expires in 7 days.

If you didn't create this account, please ignore this email.

Best regards,
MUNLY Team
    `.trim();

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
      console.log('Verification email sent successfully');
    } else {
      console.error('Failed to send verification email');
    }

  } catch (error) {
    console.error('Verification email error:', error);
  }
}

async function sendEmailNotification(data, env) {
  try {
    if (!env.NOTIFICATION_EMAIL) {
      console.log('No notification email configured, skipping email notification');
      return;
    }

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
  }
}
