import crypto from 'crypto';
export function generateQR(){ return crypto.randomBytes(18).toString('hex'); }
