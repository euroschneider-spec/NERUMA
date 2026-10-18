import 'server-only';
import { headers } from 'next/headers';

// The site's own address, for links that leave and come back (confirmation emails, Stripe). VIANORAE_SITE_URL, when set, is the only
// answer, so a forged Host/Origin cannot send anyone elsewhere. Without it (local runs, previews) the request Origin is used.
export async function siteOrigin(): Promise<string | null> {
  const origin = process.env.VIANORAE_SITE_URL || (await headers()).get('origin');
  if (!origin || !/^https?:\/\//.test(origin)) return null;
  try { return new URL(origin).origin; } catch { return null; }
}

// Browsers send Origin on every POST, so a missing header is treated as cross-site too. This
// stops other sites from spending a signed-in user's upload quota through their cookies.
export const sameOrigin=(request:Request)=>request.headers.get('origin')===new URL(request.url).origin;

// Reads a multipart body without ever holding more than `max` bytes. The declared length is a
// fast reject; the running count also covers chunked bodies that declare no length at all.
// Returns null when the body is too large; throws when it is not valid form data.
export async function limitedFormData(request:Request,max:number):Promise<FormData|null> {
  const declared=request.headers.get('content-length');
  if(declared!==null && !(Number(declared)<=max)) return null;
  if(!request.body) throw new Error('empty-body');
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  for(;;) {
    const {done,value}=await reader.read();
    if(done) break;
    size+=value.byteLength;
    if(size>max) {await reader.cancel();return null;}
    chunks.push(value);
  }
  return new Response(new Blob(chunks as BlobPart[]),{headers:{'content-type':request.headers.get('content-type') || ''}}).formData();
}
