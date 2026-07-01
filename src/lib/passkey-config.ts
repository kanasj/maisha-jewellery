// Derive RP ID and origin from environment
export const RP_NAME = 'Maisha Admin'
export const RP_ID   = process.env.NODE_ENV === 'production'
  ? 'maishajewellery.vercel.app'
  : 'localhost'
export const ORIGIN  = process.env.NODE_ENV === 'production'
  ? 'https://maishajewellery.vercel.app'
  : 'http://localhost:3000'
