'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tokenFromScan } from '@/components/HealthCard';
import { ErrorState, PageHeader } from '@/components/ui';

export default function QrScanPage() {
  const router = useRouter();
  const handled = useRef(false);
  const [cameraError, setCameraError] = useState('');
  const [invalid, setInvalid] = useState('');
  const [manual, setManual] = useState('');

  useEffect(() => {
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;
    let cancelled = false;

    (async () => {
      // Loaded only in the browser; the library touches `window` on import.
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled) return;
      scanner = new Html5Qrcode('qr-reader');
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (text) => {
            if (handled.current) return;
            const token = tokenFromScan(text);
            if (!token) {
              setInvalid('This QR code is not a SwasthyaAI health card.');
              return;
            }
            handled.current = true;
            scanner
              ?.stop()
              .catch(() => {})
              .finally(() => router.push(`/health-card/${token}`));
          },
          () => {}
        );
      } catch {
        if (!cancelled) {
          setCameraError(
            'The camera could not be opened. Allow camera access in the browser, or paste the card link below. The camera only works on localhost or https.'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (scanner?.isScanning) scanner.stop().catch(() => {});
    };
  }, [router]);

  return (
    <div className="max-w-lg">
      <PageHeader title="Scan QR health card" subtitle="Point the camera at the QR code on the patient’s card." />

      <div className="overflow-hidden rounded-xl bg-ink">
        <div id="qr-reader" className="min-h-[16rem] w-full" />
      </div>
      <div className="mt-3 space-y-2">
        {cameraError && <ErrorState message={cameraError} />}
        {invalid && <ErrorState message={invalid} />}
      </div>

      <form
        className="panel mt-6 p-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const token = tokenFromScan(manual);
          if (!token) {
            setInvalid('Paste the full card link or the card token.');
            return;
          }
          router.push(`/health-card/${token}`);
        }}
      >
        <label htmlFor="manual" className="label">Or paste the card link / token</label>
        <div className="flex gap-2">
          <input id="manual" className="input" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="…/health-card/xxxxxxxx" />
          <button type="submit" className="btn btn-primary">Open</button>
        </div>
        <p className="mt-2 text-sm text-muted">The QR holds only a random token, never health details. Opening it requires sign-in.</p>
      </form>
    </div>
  );
}
