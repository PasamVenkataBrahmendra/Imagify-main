
# Imagify AI Deployment Instructions

## Deploying to Netlify (Frontend)

1. **Push to GitHub**: Push your current project code to a GitHub repository.
2. **Connect to Netlify**: 
   - Log in to Netlify.
   - Click "Add new site" > "Import from existing project".
   - Select your GitHub repository.
3. **Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `./`
4. **Deploy**: Click "Deploy site".

## Backend (Hugging Face Stable Diffusion XL)

The backend is provided in `server.mjs` and exposes `POST /api/image/generate`, which:

- **Uses**: `stabilityai/stable-diffusion-xl-base-1.0` via Hugging Face Inference API.
- **Auth**: Reads your Hugging Face token from the `HF_TOKEN` environment variable (never from the frontend).

To run locally:

1. Install dependencies: `npm install`
2. Set `HF_TOKEN` in your shell or `.env` (not committed).
3. Start the backend: `node server.mjs`
4. In another terminal, start the frontend: `npm run dev`

## Firebase Setup
Ensure you have enabled the following in your Firebase Console:
1. **Authentication**: Enable Email/Password and Google Sign-in.
2. **Firestore**: Create a database in "Production mode" and apply the rules from `firestore-rules.txt`.
3. **Storage**: Enable Storage and apply the rules from `storage-rules.txt`.
