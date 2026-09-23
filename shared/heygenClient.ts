/**
 * Shared HeyGen API helpers.
 *
 * Three functions cover the full async avatar-video workflow:
 *   1. uploadAssetToHeyGen  — upload an image or audio file to HeyGen's asset store
 *   2. createHeygenVideo    — submit a lip-sync video job, get back a video_id
 *   3. getHeygenVideoStatus — poll job status; returns a URL when completed
 */

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface HeyGenUploadResponse {
  code?: number;
  data?: {
    asset_id?: string;
    mime_type?: string;
    size_bytes?: number;
    url?: string;
  };
  message?: string;
  error?: string | Record<string, unknown>;
}

interface HeyGenVideoCreateResponse {
  code?: number;
  data?: {
    video_id?: string;
    status?: string;
    output_format?: string;
  };
  message?: string;
  error?: string | Record<string, unknown>;
}

export interface HeyGenVideoStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  video_url?: string;
  failure_message?: string;
}

interface HeyGenVideoStatusResponse {
  code?: number;
  data?: HeyGenVideoStatus;
  message?: string;
  error?: string | Record<string, unknown>;
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string; extension: string } {
  const [header, base64Data] = dataUrl.split(',');
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const buffer = Buffer.from(base64Data, 'base64');
  // Derive a sensible file extension from the MIME type
  const extension =
    mimeType === 'image/png' ? 'png' :
    mimeType === 'image/jpeg' ? 'jpg' :
    mimeType === 'image/webp' ? 'webp' :
    mimeType === 'audio/wav' || mimeType === 'audio/x-wav' || mimeType === 'audio/wave' ? 'wav' :
    mimeType === 'audio/mpeg' || mimeType === 'audio/mp3' ? 'mp3' :
    mimeType === 'audio/m4a' || mimeType === 'audio/x-m4a' || mimeType === 'audio/mp4' ? 'm4a' :
    mimeType === 'audio/ogg' || mimeType === 'application/ogg' ? 'ogg' :
    'bin';
  return { buffer, mimeType, extension };
}

// ---------------------------------------------------------------------------
// 1. Upload an asset (image or audio) to HeyGen asset storage
//    POST https://api.heygen.com/v3/assets
//    Returns the asset_id string.
// ---------------------------------------------------------------------------
export async function uploadAssetToHeyGen(
  dataUrl: string,
  apiKey: string
): Promise<{ assetId: string; url: string }> {
  const { buffer, mimeType, extension } = dataUrlToBuffer(dataUrl);

  // Build multipart/form-data body using the Fetch FormData API (Node 18+)
  // Convert Node Buffer → plain ArrayBuffer so Blob constructor is satisfied in strict TypeScript.
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const formData = new FormData();
  const blob = new Blob([arrayBuffer], { type: mimeType });
  formData.append('file', blob, `asset.${extension}`);

  const res = await fetch('https://api.heygen.com/v3/assets', {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: formData,
  });

  const json = (await res.json()) as HeyGenUploadResponse;

  if (!res.ok || !json?.data?.asset_id) {
    console.error('HeyGen asset upload failed response:', JSON.stringify(json, null, 2));
    throw new Error(
      `HeyGen asset upload failed (HTTP ${res.status}): ${json?.message ?? (typeof json?.error === 'string' ? json.error : JSON.stringify(json))}`
    );
  }

  console.log('HeyGen asset upload success response:', JSON.stringify(json, null, 2));
  return { assetId: json.data.asset_id, url: json.data.url ?? '' };
}

// ---------------------------------------------------------------------------
// 2. Create a lip-sync video job
//    POST https://api.heygen.com/v3/videos
//    Returns the video_id string.
// ---------------------------------------------------------------------------
export async function createHeygenVideo({
  imageAssetId,
  audioAssetId,
  resolution,
  apiKey,
}: {
  imageAssetId: string;
  audioAssetId: string;
  resolution: string;
  apiKey: string;
}): Promise<string> {
  const body = {
    type: 'image',
    image: { type: 'asset_id', asset_id: imageAssetId },
    audio_asset_id: audioAssetId,
    resolution,
    aspect_ratio: 'auto',
  };

  const res = await fetch('https://api.heygen.com/v3/videos', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as HeyGenVideoCreateResponse;

  if (!res.ok || !json?.data?.video_id) {
    console.error('HeyGen video creation failed response:', JSON.stringify(json, null, 2));
    throw new Error(
      `HeyGen video creation failed (HTTP ${res.status}): ${json?.message ?? (typeof json?.error === 'string' ? json.error : JSON.stringify(json))}`
    );
  }

  console.log('HeyGen video creation success response:', JSON.stringify(json, null, 2));
  return json.data.video_id;
}

// ---------------------------------------------------------------------------
// 3. Poll video status
//    GET https://api.heygen.com/v3/videos/{videoId}
//    Returns a normalised status object.
// ---------------------------------------------------------------------------
export async function getHeygenVideoStatus(
  videoId: string,
  apiKey: string
): Promise<HeyGenVideoStatus> {
  const res = await fetch(`https://api.heygen.com/v3/videos/${videoId}`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  });

  const json = (await res.json()) as HeyGenVideoStatusResponse;

  if (!res.ok || !json?.data?.status) {
    console.error('HeyGen status check failed response:', JSON.stringify(json, null, 2));
    throw new Error(
      `HeyGen status check failed (HTTP ${res.status}): ${json?.message ?? (typeof json?.error === 'string' ? json.error : JSON.stringify(json))}`
    );
  }

  return json.data;
}
