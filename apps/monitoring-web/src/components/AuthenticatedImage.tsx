import { useEffect, useState } from 'react';

import { apiPhoto } from '../api';

export function AuthenticatedImage({
  path,
  alt,
  className,
}: {
  path: string | null;
  alt: string;
  className: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);
    if (path) {
      apiPhoto(path)
        .then((blob) => {
          objectUrl = URL.createObjectURL(blob);
          if (active) setUrl(objectUrl);
          else URL.revokeObjectURL(objectUrl);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!path || failed) return <span className={`${className} admin-photo-placeholder`}>Tidak tersedia</span>;
  if (!url) return <span className={`${className} admin-photo-placeholder`}>Memuat</span>;
  return <img className={className} src={url} alt={alt} />;
}
