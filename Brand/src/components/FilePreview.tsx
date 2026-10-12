import { useEffect, useState } from 'react';
import { Image } from '@mantine/core';

/** Previews a picked image file; revokes its object URL on change/unmount. */
export function FilePreview({ file, alt, mah = 180 }: { file: File; alt: string; mah?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  return <Image src={url} alt={alt} radius="md" mah={mah} fit="contain" />;
}
