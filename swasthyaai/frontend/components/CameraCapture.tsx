'use client';

import { useEffect, useRef, useState } from 'react';
import { IconAlert, IconCamera } from './Icons';

export interface CapturedImage {
  blob: Blob;
  filename: string;
  previewUrl: string;
  width: number;
  height: number;
  /** 0–255 average brightness, for a quick on-device hint. The backend does the real quality check. */
  brightness: number;
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

function measure(source: CanvasImageSource, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0, w, h, 0, 0, 32, 32);
  const { data } = ctx.getImageData(0, 0, 32, 32);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  return Math.round(sum / (data.length / 4));
}

export function localHint(img: CapturedImage): string | null {
  if (Math.min(img.width, img.height) < 224) return 'This photo is very small. Move closer or use the back camera.';
  if (img.brightness < 50) return 'This photo looks too dark. Move to daylight.';
  if (img.brightness > 225) return 'This photo looks too bright. Avoid direct sun and flash.';
  return null;
}

export function CameraCapture({
  shape,
  value,
  onChange,
}: {
  shape: 'eye' | 'skin';
  value: CapturedImage | null;
  onChange: (img: CapturedImage | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }

  useEffect(() => stop, []);

  async function openCamera() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open the camera here. Use “Upload photo” instead (the live camera needs https or localhost).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(
        name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in the browser settings and try again, or upload a photo.'
          : 'The camera could not be opened. Upload a photo instead.'
      );
    }
  }

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const brightness = measure(canvas, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (value) URL.revokeObjectURL(value.previewUrl);
        onChange({
          blob,
          filename: `${shape}-${Date.now()}.jpg`,
          previewUrl: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
          brightness,
        });
        stop();
      },
      'image/jpeg',
      0.92
    );
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!ALLOWED.includes(file.type)) {
      setError('Use a JPG, PNG or WEBP photo.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('This photo is larger than 10 MB. Take it again at a lower resolution.');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (value) URL.revokeObjectURL(value.previewUrl);
      onChange({
        blob: file,
        filename: file.name || `${shape}.jpg`,
        previewUrl: url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        brightness: measure(img, img.naturalWidth, img.naturalHeight),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('This file could not be read as an image.');
    };
    img.src = url;
  }

  const hint = value ? localHint(value) : null;

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onFile} />

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-ink">
        {live ? (
          <>
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            {/* Framing guide */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`border-2 border-dashed border-white/80 ${shape === 'eye' ? 'h-[38%] w-[62%] rounded-[50%]' : 'h-[60%] w-[60%] rounded-xl'}`}
              />
            </div>
            <p className="absolute inset-x-0 top-3 text-center text-sm font-medium text-white drop-shadow">
              {shape === 'eye' ? 'Fit the eye inside the oval' : 'Fit the affected patch inside the square'}
            </p>
          </>
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.previewUrl} alt="Captured photo" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-neem-100">
            <IconCamera size={36} />
            <span>No photo yet</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {live ? (
          <>
            <button type="button" onClick={snap} className="btn btn-accent px-6">
              <IconCamera size={18} /> Capture
            </button>
            <button type="button" onClick={stop} className="btn btn-ghost">Cancel</button>
          </>
        ) : (
          <>
            <button type="button" onClick={openCamera} className="btn btn-primary">
              <IconCamera size={18} /> {value ? 'Retake with camera' : 'Open camera'}
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-secondary">
              Upload photo
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(value.previewUrl);
                  onChange(null);
                }}
                className="btn btn-ghost"
              >
                Remove
              </button>
            )}
          </>
        )}
      </div>

      {(error || hint) && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-risk-moderate">
          <IconAlert size={16} className="mt-0.5 shrink-0" />
          {error || hint}
        </p>
      )}
    </div>
  );
}
