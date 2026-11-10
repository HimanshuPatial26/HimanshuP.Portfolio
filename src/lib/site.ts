// Public URL of the site, used for metadata, share images and the sitemap.
// On Vercel this picks up the production domain automatically.
export const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
