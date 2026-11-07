import { useEffect, useState } from 'react';

import { apiPhoto } from '../api';

export function AuthenticatedPhoto({
  path,
  alt,
  className,
}: {
  path: string | null;
  alt: string;
  className?: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setImageUrl(null);
    setFailed(false);

    if (path) {
      apiPhoto(path)
        .then((blob) => {
          objectUrl = URL.createObjectURL(blob);
          if (active) setImageUrl(objectUrl);
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

  if (!path || failed) {
    return <span className={`photo-placeholder ${className ?? ''}`}>Foto tidak tersedia</span>;
  }
  if (!imageUrl) {
    return <span className={`photo-placeholder ${className ?? ''}`}>Memuat foto</span>;
  }
  return <img className={className} src={imageUrl} alt={alt} />;
}
