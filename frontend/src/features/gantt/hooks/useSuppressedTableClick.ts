import { type MouseEvent, useCallback, useEffect, useRef } from "react";

/** ドラッグ終了直後に発火するclickを一度だけ無効化します。 */
export function useSuppressedTableClick() {
  const suppressClickRef = useRef(false);
  const releaseTimerRef = useRef<number | null>(null);

  const suppressNextClick = useCallback(() => {
    suppressClickRef.current = true;
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
    }
    releaseTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      releaseTimerRef.current = null;
    }, 0);
  }, []);

  const handleClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) {
      return;
    }
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(
    () => () => {
      if (releaseTimerRef.current !== null) {
        window.clearTimeout(releaseTimerRef.current);
      }
    },
    [],
  );

  return { handleClickCapture, suppressNextClick };
}
