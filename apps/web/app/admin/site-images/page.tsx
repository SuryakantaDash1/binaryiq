'use client';

import {
  SITE_IMAGE_CONTENT_TYPES,
  SITE_IMAGE_MAX_BYTES,
  SITE_IMAGE_SLOT_INFO,
  type AdminSiteImageView,
  type SiteImageSlot,
} from '@binaryiq/types';
import { ExternalLink, RotateCcw, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { adminApi } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';
import { apiImageUrl } from '@/lib/api/site-images';

/** Longest edge after resizing — sharp on large screens while keeping uploads small. */
const MAX_EDGE = 2400;

const SHAPE_HINT: Record<'tall' | 'wide', string> = {
  tall: 'Tall tile — the sides get cropped, so keep the subject near the centre.',
  wide: 'Wide tile — the top and bottom get cropped.',
};

function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Downscales the photo in the browser and re-encodes it (WebP, else JPEG) so uploads stay well under the limit. */
async function prepareImage(file: File): Promise<Blob> {
  if (!(SITE_IMAGE_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP image.');
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob = await encode(canvas, 'image/webp', 0.85);
  // Browsers that can't encode WebP silently return a PNG — use JPEG instead.
  if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', 0.85);
  if (!blob) throw new Error('Could not process this image.');
  if (blob.size > SITE_IMAGE_MAX_BYTES) throw new Error('This image is too large even after resizing.');
  return blob;
}

export default function AdminSiteImagesPage(): React.JSX.Element {
  const [rows, setRows] = useState<AdminSiteImageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .listSiteImages()
      .then(setRows)
      .catch(() => setError('Failed to load site images.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function replaceRow(next: AdminSiteImageView): void {
    setRows((prev) => prev.map((r) => (r.slot === next.slot ? next : r)));
  }

  const customCount = rows.filter((r) => r.path).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black text-text md:hidden">Site Images</h1>
        <p className="text-sm text-secondary">
          {customCount} of {rows.length || 9} photos customised · changes appear on the site within about a minute
        </p>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {loading && rows.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-80 animate-pulse rounded-xl border border-border bg-surface" />
            ))
          : rows.map((r) => <SiteImageCard key={r.slot} row={r} onChange={replaceRow} />)}
      </div>
    </div>
  );
}

function SiteImageCard({
  row,
  onChange,
}: {
  row: AdminSiteImageView;
  onChange: (next: AdminSiteImageView) => void;
}): React.JSX.Element {
  const info = SITE_IMAGE_SLOT_INFO[row.slot as SiteImageSlot];
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free the local preview's object URL when it's replaced or the card unmounts.
  useEffect(() => {
    if (!pending) return;
    return () => URL.revokeObjectURL(pending.previewUrl);
  }, [pending]);

  const currentUrl = row.path ? apiImageUrl(row.path) : info.defaultUrl;
  const shownUrl = pending?.previewUrl ?? currentUrl;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const blob = await prepareImage(file);
      setPending({ blob, previewUrl: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this image.');
    }
  }

  async function save(): Promise<void> {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await adminApi.uploadSiteImage(row.slot, pending.blob));
      setPending(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function reset(): Promise<void> {
    if (!window.confirm(`Reset "${info.label}" to the original photo?`)) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await adminApi.resetSiteImage(row.slot));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="relative h-48 bg-surface-alt">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${shownUrl})` }} />
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            pending
              ? 'bg-amber-100 text-amber-800'
              : row.path
                ? 'bg-brand-50 text-brand-800'
                : 'bg-white/90 text-gray-600'
          }`}
        >
          {pending ? 'Unsaved preview' : row.path ? 'Custom' : 'Default'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="font-semibold text-text">{info.label}</p>
          <p className="text-xs text-secondary">{info.usedOn}</p>
          <p className="mt-1 text-xs text-secondary">{SHAPE_HINT[info.shape]}</p>
          {row.updatedAt && row.byteSize !== null && !pending && (
            <p className="mt-1 text-xs text-secondary">
              Updated {new Date(row.updatedAt).toLocaleString()} · {formatBytes(row.byteSize)}
            </p>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <input ref={fileInput} type="file" accept={SITE_IMAGE_CONTENT_TYPES.join(',')} className="hidden" onChange={(e) => void onFile(e)} />

        <div className="mt-auto flex flex-wrap gap-2">
          {pending ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:bg-background disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Replace
              </button>
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:bg-background"
              >
                <ExternalLink className="h-4 w-4" />
                View
              </a>
              {row.path && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reset()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to default
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
