/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface SwipeRowProps {
  rowKey: string;
  swipeOpenKey: string | null;
  onOpenChange: (key: string | null) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const SwipeRow: React.FC<SwipeRowProps> = ({
  rowKey,
  swipeOpenKey,
  onOpenChange,
  onEdit,
  onDelete,
  className = '',
  style,
  children,
}) => {
  const isOpen = swipeOpenKey === rowKey;
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Sync state when closed externally
  useEffect(() => {
    if (!isOpen) {
      setOffsetX(0);
    }
  }, [isOpen]);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isHorizontalRef = useRef<boolean | null>(null);
  const hasMovedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button
    if (e.button !== 0) return;
    e.stopPropagation();

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentOffsetRef.current = offsetX;
    isDraggingRef.current = true;
    isHorizontalRef.current = null;
    hasMovedRef.current = false;
    pointerIdRef.current = e.pointerId;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Detect direction on initial movement
    if (isHorizontalRef.current === null) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        if (Math.abs(dx) > Math.abs(dy)) {
          isHorizontalRef.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore if pointer capture fails
          }
          setIsDragging(true);
        } else {
          isHorizontalRef.current = false;
          isDraggingRef.current = false;
          return;
        }
      } else {
        return;
      }
    }

    if (!isHorizontalRef.current) return;

    if (Math.abs(dx) > 6) {
      hasMovedRef.current = true;
    }

    // Limit drag to [-72, +72]
    let nextOffset = currentOffsetRef.current + dx;
    if (nextOffset > 72) nextOffset = 72;
    if (nextOffset < -72) nextOffset = -72;

    setOffsetX(nextOffset);
  };

  const endDrag = useCallback(
    (e?: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      if (e && pointerIdRef.current !== null) {
        try {
          e.currentTarget.releasePointerCapture(pointerIdRef.current);
        } catch {
          // ignore
        }
      }
      pointerIdRef.current = null;

      // Determine snap position
      // Swipe Right (offsetX > 0) -> reveals left "حذف" button (64px)
      // Swipe Left (offsetX < 0) -> reveals right "تعديل" button (-64px)
      if (offsetX > 32) {
        setOffsetX(64);
        onOpenChange(rowKey);
      } else if (offsetX < -32) {
        setOffsetX(-64);
        onOpenChange(rowKey);
      } else {
        setOffsetX(0);
        if (isOpen) {
          onOpenChange(null);
        }
      }
    },
    [offsetX, isOpen, rowKey, onOpenChange]
  );

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    // If we moved > 6px, suppress clicks inside
    if (hasMovedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasMovedRef.current = false;
      return;
    }

    // If the card was open and clicked, close it and suppress action
    if (isOpen) {
      e.stopPropagation();
      e.preventDefault();
      setOffsetX(0);
      onOpenChange(null);
    }
  };

  const showButtons = isDragging || isOpen || offsetX !== 0;

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={style}
    >
      {/* Background action button: "حذف" on LEFT edge (revealed when dragging right > 0) */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOffsetX(0);
            onOpenChange(null);
            onDelete();
          }}
          className="absolute left-0 top-0 bottom-0 w-[64px] bg-[#C0394F] text-white font-[700] text-[10px] flex items-center justify-center cursor-pointer transition hover:bg-[#A93245] active:scale-95 rounded-[inherit]"
          style={{
            zIndex: 1,
            visibility: showButtons ? 'visible' : 'hidden',
            opacity: showButtons ? 1 : 0,
            pointerEvents: isOpen && offsetX > 0 ? 'auto' : 'none',
          }}
        >
          حذف
        </button>
      )}

      {/* Background action button: "تعديل" on RIGHT edge (revealed when dragging left < 0) */}
      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOffsetX(0);
            onOpenChange(null);
            onEdit();
          }}
          className="absolute right-0 top-0 bottom-0 w-[64px] bg-[#5F2967] text-white font-[700] text-[10px] flex items-center justify-center cursor-pointer transition hover:bg-[#4E2155] active:scale-95 rounded-[inherit]"
          style={{
            zIndex: 1,
            visibility: showButtons ? 'visible' : 'hidden',
            opacity: showButtons ? 1 : 0,
            pointerEvents: isOpen && offsetX < 0 ? 'auto' : 'none',
          }}
        >
          تعديل
        </button>
      )}

      {/* Foreground draggable card */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleClickCapture}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? 'none' : 'transform 180ms ease-out',
          touchAction: 'pan-y',
          position: 'relative',
          zIndex: 2,
        }}
        className="w-full h-full rounded-[inherit]"
      >
        {children}
      </div>
    </div>
  );
};
