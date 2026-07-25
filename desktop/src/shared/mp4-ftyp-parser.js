'use strict';

/**
 * parseFtyp — parse an ISO/IEC 14496-12 ftyp box and infer the video codec 4CC.
 *
 * IMPORTANT CAVEAT (per audit #47 + honest scope):
 *   The ftyp box contains BRAND IDENTIFIERS (4 ASCII chars each), not full codec
 *   profile strings. The profile/level (e.g. avc1.640028 = H.264 High@4.0) lives in
 *   codec-specific configuration boxes (avcC / hvcC / vpcC) that we do NOT parse
 *   here. Modern Chromium MSE accepts the 4CC codec hint (e.g. "avc1") and reads
 *   the actual profile from the stream's codec config box, so returning the 4CC
 *   is sufficient for source-buffer creation.
 *
 *   To get the full "avc1.640028" string we'd need to walk past the moov box
 *   into the avcC atom — that's B-D+ scope, not B-C.
 *
 * Box layout (ISO/IEC 14496-12 §4.3):
 *   size           4 bytes  (big-endian; 0 means "extends to EOF")
 *   type           4 bytes  ('ftyp')
 *   major_brand    4 bytes
 *   minor_version  4 bytes
 *   compatible_brands  N × 4 bytes
 *
 * Returns: { mimeType, codec }
 *   mimeType: always 'video/mp4' for fragmented MP4 (fMP4)
 *   codec:    video codec 4CC hint ('avc1', 'hvc1', 'hev1', 'av01', 'vp09')
 *             — or null if no recognized video brand found
 */

const VIDEO_BRAND_HINTS = {
  // H.264 / AVC family (most common in legacy MP4)
  avc1: 'avc1',
  avc3: 'avc1',
  // HEVC / H.265 family
  hvc1: 'hvc1',
  hev1: 'hev1',
  hevc: 'hvc1',
  // AV1
  av01: 'av01',
  // VP9
  vp09: 'vp09',
  vp9:  'vp09',
  // VP8
  vp08: 'vp08',
};

function readBrand(bytes, offset) {
  // Brand is 4 ASCII chars; tolerate non-ASCII by mapping to ''
  let s = '';
  for (let i = 0; i < 4; i++) {
    const c = bytes[offset + i];
    s += (c >= 0x20 && c <= 0x7e) ? String.fromCharCode(c) : '';
  }
  return s;
}

function parseFtyp(bytes) {
  if (!bytes || bytes.byteLength < 16) {
    throw new Error('FTYP_TOO_SHORT');
  }
  // Tag is at bytes[4..7] = 'ftyp'
  const tag = readBrand(bytes, 4);
  if (tag !== 'ftyp') {
    throw new Error('NOT_FTYP');
  }

  const majorBrand = readBrand(bytes, 8);
  // minor_version at bytes[12..15] — ignore

  // Walk compatible_brands starting at offset 16, 4 bytes each,
  // until we run out of bytes.
  let codec = null;

  // Check major brand first (often the strongest signal)
  if (VIDEO_BRAND_HINTS[majorBrand]) {
    codec = VIDEO_BRAND_HINTS[majorBrand];
  }

  if (!codec) {
    const numBytes = bytes.byteLength;
    for (let off = 16; off + 4 <= numBytes; off += 4) {
      const brand = readBrand(bytes, off);
      if (VIDEO_BRAND_HINTS[brand]) {
        codec = VIDEO_BRAND_HINTS[brand];
        break;
      }
    }
  }

  // Fallback: if no recognized video brand found, default to avc1 (H.264).
  // Modern Chromium MSE will read the actual codec profile from the stream's
  // avcC / hvcC box; the 4CC hint is enough for SourceBuffer MIME validation.
  if (!codec) codec = 'avc1';

  return {
    mimeType: 'video/mp4',
    majorBrand,
    codec,                  // 4CC hint, e.g. 'avc1'; null if unrecognized
    isFragmented: true,     // fMP4 from container-transmux is always fragmented
  };
}

module.exports = { parseFtyp };

// Browser-side exposure (Electron renderer with contextIsolation has no require)
// Exposed onto a shared namespace so app.js can pull all media helpers in one place.
if (typeof window !== 'undefined') {
  window.SyncPlayMedia = window.SyncPlayMedia || {};
  window.SyncPlayMedia.parseFtyp = parseFtyp;
}