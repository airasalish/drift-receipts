import { useState, type ImgHTMLAttributes } from "react";

// An <img> that never shows a broken-image box: if it fails, it renders the
// fallback (a letter tile by default) or nothing.
export function SafeImg({ fallback, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fallback?: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed || !props.src) return <>{fallback ?? null}</>;
  return <img referrerPolicy="no-referrer" loading="lazy" {...props} onError={() => setFailed(true)} />;
}
