import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, Modal, TextField } from '@wfh-attendance/ui';

const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 1600;

export function PhotoCapture({
  open,
  notesEnabled,
  onClose,
  onSubmit,
}: {
  open: boolean;
  notesEnabled: boolean;
  onClose: () => void;
  onSubmit: (photo: File, notes: string) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [cameraSession, setCameraSession] = useState(0);
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);

  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    setPhoto(null);
    setNotes('');
    setError('');
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Akses kamera tidak tersedia. Silakan pilih gambar.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (active) setCameraError('Izin kamera tidak tersedia. Silakan pilih gambar.');
      });

    return () => {
      active = false;
      stopCamera();
    };
  }, [open, cameraSession]);

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError('Tunggu hingga pratinjau kamera siap sebelum mengambil foto.');
      return;
    }

    const canvas = document.createElement('canvas');
    const scale = Math.min(
      1,
      MAX_PHOTO_DIMENSION / Math.max(video.videoWidth, video.videoHeight),
    );
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    await saveCompressedPhoto(canvas);
  }

  async function selectPhoto(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Pilih gambar JPEG atau PNG.');
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      await saveCompressedPhoto(canvas);
    } catch {
      setError('Gambar tidak dapat dibuka. Coba file JPEG atau PNG lain.');
    }
  }

  async function saveCompressedPhoto(canvas: HTMLCanvasElement) {
    try {
      const blob = await compressCanvas(canvas);
      setPhoto(new File([blob], 'attendance.jpg', { type: 'image/jpeg' }));
      stopCamera();
      setError('');
    } catch {
      setError('Foto tidak dapat dikompres. Coba gambar lain.');
    }
  }

  async function submitPhoto() {
    if (!photo) {
      setError('Ambil foto atau pilih gambar sebelum melanjutkan.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await onSubmit(photo, notes);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Presensi gagal disimpan. Silakan coba lagi.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  return (
    <Modal open={open} title="Ambil foto presensi" onClose={onClose}>
      <div className="capture-content">
        {photo ? (
          <div className="capture-preview">
            {photoUrl && <img src={photoUrl} alt="Foto presensi yang dipilih" />}
            <Button
              variant="secondary"
              onClick={() => {
                setPhoto(null);
                setCameraError('');
                setCameraSession((session) => session + 1);
              }}
            >
              Ambil ulang foto
            </Button>
          </div>
        ) : (
          <>
            <div className="camera-frame">
              <video ref={videoRef} autoPlay muted playsInline aria-label="Pratinjau kamera" />
              {cameraError && <p role="status">{cameraError}</p>}
            </div>
            <div className="capture-actions">
              <Button onClick={capturePhoto} disabled={Boolean(cameraError)}>
                Ambil foto
              </Button>
              <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                Pilih foto
              </Button>
              <input
                ref={inputRef}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png"
                capture="user"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  void selectPhoto(file);
                }}
              />
            </div>
          </>
        )}
        {notesEnabled && (
          <TextField
            label="Lokasi kerja atau catatan (opsional)"
            value={notes}
            maxLength={500}
            onChange={(event) => setNotes(event.target.value)}
          />
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="capture-footer">
          <span>Foto JPEG · maksimal 2 MB</span>
          <Button onClick={() => void submitPhoto()} disabled={!photo || isSaving}>
            {isSaving ? 'Menyimpan…' : 'Kirim presensi'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function compressCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let quality = 0.86;
    let scale = 1;

    const encode = () => {
      const output = document.createElement('canvas');
      output.width = Math.max(1, Math.round(canvas.width * scale));
      output.height = Math.max(1, Math.round(canvas.height * scale));
      output.getContext('2d')?.drawImage(canvas, 0, 0, output.width, output.height);
      output.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not encode photo.'));
          } else if (blob.type === 'image/jpeg' && blob.size <= MAX_COMPRESSED_BYTES) {
            resolve(blob);
          } else if (quality > 0.5) {
            quality -= 0.12;
            encode();
          } else if (scale > 0.4) {
            quality = 0.78;
            scale *= 0.75;
            encode();
          } else {
            reject(new Error('Compressed photo exceeds the size limit.'));
          }
        },
        'image/jpeg',
        quality,
      );
    };

    encode();
  });
}
