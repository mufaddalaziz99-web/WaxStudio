import 'server-only';
import crypto from 'node:crypto';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { env } from './env';
import { badRequest } from './http';

const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Cloudinary signed direct-upload parameters (the browser uploads straight to Cloudinary).
 * Returns null when Cloudinary is not configured — callers then POST the file to /api/uploads.
 */
export async function cloudinarySignature(folder = 'products') {
  if (!env.hasCloudinary) return null;
  const { v2: cloudinary } = await import('cloudinary');
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { timestamp, folder: `store/${folder}` };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
  return {
    url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: process.env.CLOUDINARY_API_KEY,
    ...params,
    signature,
  };
}

/** Server-side upload (S3/R2 or local /public/uploads). `file` is a web File from formData. */
export async function storeUpload(file, folder = 'misc') {
  if (!file || typeof file.arrayBuffer !== 'function') throw badRequest('No file uploaded', 'no_file');
  const ext = ALLOWED[file.type];
  if (!ext) throw badRequest('Only JPG, PNG, WebP, AVIF or GIF images are allowed', 'bad_type');
  if (file.size > MAX_UPLOAD_BYTES) throw badRequest('Image is too large (max 8 MB)', 'too_large');
  const buf = Buffer.from(await file.arrayBuffer());
  const name = `${folder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

  if (env.storageDriver === 'cloudinary') {
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const res = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ folder: `store/${folder}` }, (err, r) => (err ? reject(err) : resolve(r))).end(buf);
    });
    return res.secure_url;
  }

  if (env.storageDriver === 's3') {
    // Minimal S3/R2 PUT using a presign-free path requires an SDK; keep the dependency optional.
    throw badRequest('S3 storage driver requires @aws-sdk/client-s3; install it or use Cloudinary.', 'storage_unavailable');
  }

  if (env.isProd && !process.env.ALLOW_LOCAL_UPLOADS) {
    throw badRequest('Image storage is not configured.', 'storage_unavailable');
  }
  const dir = path.join(process.cwd(), 'public', 'uploads', folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(process.cwd(), 'public', 'uploads', name), buf);
  return `/uploads/${name}`;
}
