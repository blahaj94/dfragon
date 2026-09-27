import { randomBytes } from 'node:crypto'
export const opaque = () => randomBytes(32).toString('base64url')
