"use client";

import { useCallback, useState } from "react";

/**
 * Native HTML5 drag-to-reorder for a vertical list.
 *
 * No dnd-kit: this is two admin lists behind a login, and the whole behaviour
 * is a dragstart, a dragover and a drop. What a library would buy here is
 * touch and keyboard support — and the ↑/↓ buttons already cover keyboard, so
 * they stay rather than being replaced by the handle.
 *
 * The list is reordered locally as you drag so the row follows the cursor, and
 * `onCommit` fires once on drop with the final id order. Nothing is written
 * mid-drag: an action per dragover would be a write for every pixel.
 */
export function useListDrag<T>({
  items,
  getId,
  onCommit,
  disabled = false,
}: {
  items: T[];
  getId: (item: T) => string;
  /** Called once, on drop, with the ids in their new order. */
  onCommit: (orderedIds: string[]) => void;
  disabled?: boolean;
}) {
  /** Non-null only while a drag is in flight; this is the live preview. */
  const [order, setOrder] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const ids = items.map(getId);
  // While dragging, render from the preview; otherwise from props, so a
  // server refresh is what ends the drag rather than local state going stale.
  const currentIds = order ?? ids;

  const byId = new Map(items.map((item) => [getId(item), item]));
  const ordered = currentIds
    .map((id) => byId.get(id))
    .filter((item): item is T => item !== undefined);

  const onDragStart = useCallback(
    (id: string) => (e: React.DragEvent) => {
      if (disabled) return;
      setDraggingId(id);
      setOrder(ids);
      // Firefox ignores a drag that carries no data.
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    },
    [disabled, ids]
  );

  const onDragOver = useCallback(
    (overId: string) => (e: React.DragEvent) => {
      if (disabled || !draggingId || draggingId === overId) return;
      // Without this the browser refuses the drop outright.
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      setOrder((prev) => {
        const list = prev ?? ids;
        const from = list.indexOf(draggingId);
        const to = list.indexOf(overId);
        if (from === -1 || to === -1 || from === to) return list;
        const next = [...list];
        next.splice(to, 0, next.splice(from, 1)[0]);
        return next;
      });
    },
    [disabled, draggingId, ids]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const finalOrder = order;
      setDraggingId(null);
      // Cleared here, not in a refresh callback: if the order is unchanged
      // there is no refresh coming, and the preview would pin the list.
      setOrder(null);
      if (!finalOrder) return;
      const changed = finalOrder.some((id, i) => id !== ids[i]);
      if (changed) onCommit(finalOrder);
    },
    [order, ids, onCommit]
  );

  /** Fires when a drag is abandoned — Esc, or dropped outside the list. */
  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setOrder(null);
  }, []);

  return {
    /** The items in their current (possibly mid-drag) order. */
    ordered,
    draggingId,
    /** Spread onto each row; `id` is that row's id. */
    rowProps: (id: string) => ({
      draggable: !disabled,
      onDragStart: onDragStart(id),
      onDragOver: onDragOver(id),
      onDrop,
      onDragEnd,
    }),
  };
}
