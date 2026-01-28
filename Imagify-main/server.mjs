import express from 'express';

// Simple Express backend providing /api/image/generate backed by
// Hugging Face Inference API (Stable Diffusion XL).
//
// Requirements:
// - Set HF_TOKEN in your environment (never expose this to the frontend).
// - Run with: `node server.mjs` (or add an npm script).
//
// This file assumes Node 18+ so that global fetch is available.

const app = express();
app.use(express.json({ limit: '2mb' }));

// CORS for Netlify frontend
app.use((req, res, next) => {
  const allowedOrigin = 'https://musical-empanada-e9c54b.netlify.app'; // your Netlify URL
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Hugging Face Inference Router endpoint for SDXL
const HF_MODEL_URL =
  'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0';


/**
 * Helper to call Hugging Face Inference API with basic retry
 * handling for rate limiting and model loading.
 */
async function callHuggingFace(prompt, token, maxRetries = 3) {
  const body = {
    inputs: prompt,
    // You can tune these parameters as needed.
    parameters: {
      num_inference_steps: 30,
      guidance_scale: 7.5,
    },
  };

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(HF_MODEL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'image/png',
      },
      body: JSON.stringify(body),
    });

    // 401 – bad / missing token
    if (res.status === 401) {
      const text = await res.text();
      const err = new Error('Unauthorized with Hugging Face token');
      err.status = 401;
      err.details = text;
      throw err;
    }

    // 503 – model loading (return a hint to caller)
    if (res.status === 503) {
      let payload;
      try {
        payload = await res.json();
      } catch {
        payload = {};
      }
      const err = new Error('Model is loading, please retry in a few seconds.');
      err.status = 503;
      err.details = payload;
      throw err;
    }

    // 429 – rate limit: wait and retry
    if (res.status === 429) {
      lastError = new Error('Rate limited by Hugging Face');
      lastError.status = 429;

      const retryAfterHeader = res.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader
        ? parseInt(retryAfterHeader, 10)
        : 2;
      // Simple backoff before next attempt
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryAfterSeconds * 1000),
        );
        continue;
      }

      // If we exhausted retries, throw
      throw lastError;
    }

    // Any other non-OK status: surface as error
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(
        `Failed to call Hugging Face API (status ${res.status})`,
      );
      err.status = res.status;
      err.details = text;
      throw err;
    }

    // Success – return raw PNG bytes
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/png';
    return { buffer, contentType };
  }

  // Should not reach here, but keep TS/JS happy
  throw lastError || new Error('Unexpected Hugging Face error');
}

/**
 * POST /api/image/generate
 * Body: { "prompt": string }
 *
 * Returns: PNG image bytes from Stable Diffusion XL.
 */
app.post('/api/image/generate', async (req, res) => {
  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res
        .status(400)
        .json({ error: 'Request body must include a non-empty "prompt" string.' });
    }

    const token = process.env.HF_TOKEN;
    if (!token) {
      return res.status(500).json({
        error:
          'HF_TOKEN is not configured on the server. Set HF_TOKEN in your environment.',
      });
    }

    const { buffer, contentType } = await callHuggingFace(prompt, token);

    res.setHeader('Content-Type', contentType);
    // Optional: prevent caching of generated images
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (err) {
    console.error('Error in /api/image/generate:', err);

    const status = err.status || 500;
    // 503 model loading – forward a clear retry message
    if (status === 503) {
      return res.status(503).json({
        error: 'Model is currently loading on Hugging Face. Please retry shortly.',
        details: err.details || null,
      });
    }

    // 401 – token / auth issues
    if (status === 401) {
      return res.status(401).json({
        error:
          'Hugging Face returned 401 Unauthorized. Check that HF_TOKEN is valid and has access to the model.',
        details: err.details || null,
      });
    }

    // 429 – rate limiting after retries
    if (status === 429) {
      return res.status(429).json({
        error:
          'Rate limit reached on Hugging Face. Please wait a moment and try again.',
      });
    }

    return res.status(status).json({
      error: 'Unexpected error while generating image.',
      details: err.message || String(err),
    });
  }
});

// In production you would typically mount this behind your main server or
// platform-specific adapter. For local use, we expose a default port.
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Image generation backend listening on http://localhost:${PORT}`);
});


