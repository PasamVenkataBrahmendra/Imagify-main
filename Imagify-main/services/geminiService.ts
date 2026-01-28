

/**
 * Frontend adapter for the backend Stable Diffusion XL endpoint.
 *
 * NOTE:
 * - The actual model call and HF_TOKEN are handled entirely on the backend
 *   at POST /api/image/generate (see server.mjs).
 * - This file only talks to that backend endpoint; no API keys live in the browser.
 */

const BACKEND_ENDPOINT = '/api/image/generate';

/**
 * Low-level helper to send a prompt to the backend and get back a browser-usable image URL.
 *
 * The backend returns a raw PNG image; here we convert that to an object URL
 * (blob URL) that can be used directly in <img src="...">.
 */
async function requestImageFromBackend(prompt: string): Promise<string> {
  const res = await fetch(BACKEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  // If the backend returns JSON, it's an error payload.
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const errorJson = await res.json().catch(() => ({}));
      const message =
        errorJson.error ||
        (typeof errorJson === 'string' ? errorJson : 'Image generation failed.');
      throw new Error(message);
    }

    const text = await res.text().catch(() => '');
    throw new Error(
      text || `Image generation failed with status ${res.status}.`,
    );
  }

  // Success path: backend sent image/png
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  return objectUrl;
}

/* Exported functions mimic previous API shape so UI plumbing remains the same */

/** Generate an image from text using Stable Diffusion XL via backend. */
export const generateImageFromText = async (
  prompt: string,
  style: string,
  size: string,
) => {
  const fullPrompt = `Generate an image with the following description: ${prompt}. Style: ${style}. Aspect ratio: ${size}. Use high quality, detailed Stable Diffusion XL output.`;

  const imageUrl = await requestImageFromBackend(fullPrompt);
  return imageUrl;
};

/**
 * Transform style of a provided image (expects data URL).
 *
 * NOTE:
 * - SDXL Inference API used here is text-to-image only; we approximate
 *   style transforms by guiding the prompt with the original image type.
 */
export const styleTransform = async (
  imgDataUrl: string,
  style: string,
  refinePrompt?: string,
) => {
  const extra = refinePrompt ? ` ${refinePrompt}` : '';
  const fullPrompt = `Create a new image in the style of "${style}" based on the following reference image. The reference is provided as a base64 data URL; keep key subject details consistent while applying the new style.${extra} Reference (for human guidance only): ${imgDataUrl.slice(
    0,
    200,
  )}...`;

  const imageUrl = await requestImageFromBackend(fullPrompt);
  return imageUrl;
};

/**
 * Fuse two images into one.
 *
 * As with styleTransform, this is approximated via a descriptive prompt
 * since the text-only SDXL endpoint does not take image binaries directly.
 */
export const fuseImages = async (imgAUrl: string, imgBUrl: string) => {
  const fullPrompt = `Create a single cohesive image that fuses two source images. Use the first image as the main subject and the second as the background or stylistic reference. The images are provided as data URLs and are meant only as guidance for what to depict. Image A (subject, truncated): ${imgAUrl.slice(
    0,
    200,
  )}... Image B (style/background, truncated): ${imgBUrl.slice(0, 200)}...`;

  const imageUrl = await requestImageFromBackend(fullPrompt);
  return imageUrl;
};

/**
 * Run a "fit check" visualization via text-only SDXL prompt.
 *
 * We instruct the model to visualize a person wearing the outfit; any
 * textual "analysis" remains mocked/derived at the UI layer.
 */
export const runFitCheck = async (personUrl: string, outfitUrl: string) => {
  const fullPrompt = `Visualize how a person would look wearing a given outfit. The first reference image is the person, and the second is the outfit. Generate a flattering but realistic visualization of the person wearing the outfit, with clear lighting and neutral background. Person image (truncated data URL): ${personUrl.slice(
    0,
    200,
  )}... Outfit image (truncated data URL): ${outfitUrl.slice(0, 200)}...`;

  const imageUrl = await requestImageFromBackend(fullPrompt);

  // The UI expects { imageUrl, analysis }, but the actual "analysis"
  // was not previously backed by a robust model in any reliable way. Here we provide a
  // simple placeholder analysis so the layout remains unchanged.
  const analysis = {
    score: 8,
    suggestions:
      'Overall fit looks good. Consider adjusting lighting and background for a more polished final photo.',
    colorFeedback:
      'Colors of the outfit complement the skin tone and background nicely.',
    occasion: 'Suitable for casual outings, social events, and smart-casual settings.',
  };

  return { imageUrl, analysis };
};

