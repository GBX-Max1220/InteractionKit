// Backend endpoint for the InteractionKit study backend.
// Override at build time with NEXT_PUBLIC_IK_BACKEND_URL, else local dev.
export const BACKEND_URL: string =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_IK_BACKEND_URL) ||
  'http://localhost:8000';
