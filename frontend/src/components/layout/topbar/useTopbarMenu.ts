import { useCallback, useEffect, useRef, useState } from "react";

import type { TopbarMenu } from "./types";

/** Topbar内で同時に開くポップアップを一つに制限し、共通の終了条件を管理します。 */
export function useTopbarMenu() {
  const [openMenu, setOpenMenu] = useState<TopbarMenu | null>(null);
  const topbarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (openMenu === null) {
      return;
    }
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !topbarRef.current?.contains(event.target)) {
        setOpenMenu(null);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  const closeMenu = useCallback(() => setOpenMenu(null), []);
  const toggleMenu = useCallback(
    (menu: TopbarMenu) => setOpenMenu((current) => (current === menu ? null : menu)),
    [],
  );

  return {
    closeMenu,
    openMenu,
    setOpenMenu,
    toggleMenu,
    topbarRef,
  };
}
