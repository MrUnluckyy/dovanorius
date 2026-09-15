"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 *
 * Spread `rowProps` on every row AND `containerProps` on the <ul>/<tbody> —
 * the container is where dragover and drop are actually handled, so a list
 * missing it will not accept a drop at all.
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
  /**
   * The local order. Non-null while a drag is in flight, and held past the
   * drop until the write settles — see `release` below.
   */
  const [order, setOrder] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const ids = items.map(getId);
  const idsKey = ids.join("|");

  // Handlers read live values through refs so they can stay referentially
  // stable; `ids` is a fresh array every render and would bust every dep.
  const idsRef = useRef(ids);
  idsRef.current = ids;
  /**
   * The preview, readable synchronously.
   *
   * `dragend` can fire before React has re-rendered with the last `setOrder`
   * from `dragover`, so a handler closing over the `order` state variable saw
   * a stale list and concluded nothing had changed — the reorder was dropped,
   * intermittently and only on fast gestures. Every write goes through
   * `applyOrder`, which updates this ref and the state together.
   */
  const orderRef = useRef<string[] | null>(order);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // While dragging, render from the preview; otherwise from props, so a
  // server refresh is what ends the drag rather than local state going stale.
  const currentIds = order ?? ids;

  const byId = new Map(items.map((item) => [getId(item), item]));
  const ordered = currentIds
    .map((id) => byId.get(id))
    .filter((item): item is T => item !== undefined);

  /** The <ul>/<tbody>, so a dragend can ask whether it ended over the list. */
  const containerRef = useRef<HTMLElement | null>(null);
  const setContainer = useCallback((el: HTMLElement | null) => {
    containerRef.current = el;
  }, []);

  const applyOrder = useCallback((next: string[] | null) => {
    orderRef.current = next;
    setOrder(next);
  }, []);

  /** True between handing an order to `onCommit` and the write settling. */
  const committing = useRef(false);
  const release = useCallback(() => {
    committing.current = false;
    applyOrder(null);
  }, [applyOrder]);

  /**
   * Drop the preview once the truth has landed.
   *
   * Clearing it in `onDrop` made the list snap back to the old order for the
   * whole round-trip, then jump forward again when the refresh arrived. So the
   * preview is held and released on either signal: the caller's pending flag
   * falling (the write finished — and if it *failed* the caller skipped its
   * refresh, so falling back to props is the right outcome), or props arriving
   * in a different order.
   */
  const wasPending = useRef(false);
  useEffect(() => {
    if (disabled) {
      wasPending.current = true;
      return;
    }
    if (wasPending.current) {
      wasPending.current = false;
      release();
    }
  }, [disabled, release]);

  const settledKey = useRef(idsKey);
  useEffect(() => {
    if (settledKey.current !== idsKey) {
      settledKey.current = idsKey;
      release();
    }
  }, [idsKey, release]);

  const onDragStart = useCallback(
    (id: string) => (e: React.DragEvent) => {
      if (disabled) return;
      // The whole row is draggable, but its own controls are not handles —
      // grabbing the "why this one?" input should place a cursor, not start a
      // drag, and a click on ↑/↓ should stay a click.
      if (
        e.target instanceof Element &&
        e.target.closest("input, textarea, select, button, a")
      ) {
        e.preventDefault();
        return;
      }
      committing.current = false;
      setDraggingId(id);
      applyOrder(idsRef.current);
      // Firefox ignores a drag that carries no data.
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    },
    [disabled, applyOrder]
  );

  /**
   * Where the dragged row belongs, given only the pointer and the rows as
   * currently laid out: the number of other rows whose midpoint sits above the
   * cursor.
   *
   * Deriving the index from geometry rather than from "which row fired the
   * event" is what makes this stable. Swapping with whatever row was hovered
   * made the pair trade places every few pixels, because each swap put the
   * neighbour straight back under the cursor; and a midpoint rule keyed on
   * drag direction disagreed with itself at the exact centre of a row, so
   * releasing on the top half of a row while dragging down did nothing.
   */
  const indexForPointer = useCallback(
    (container: Element, clientY: number, dragged: string): number => {
      const rows = Array.from(container.children) as HTMLElement[];
      const list = orderRef.current ?? idsRef.current;
      let index = 0;
      for (let i = 0; i < Math.min(rows.length, list.length); i++) {
        if (list[i] === dragged) continue;
        const rect = rows[i].getBoundingClientRect();
        if (clientY > rect.top + rect.height / 2) index++;
      }
      return index;
    },
    []
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled || !draggingId) return;

      // Unconditionally, and before anything can bail out: an element whose
      // dragover does not preventDefault is telling the browser it refuses the
      // drop. This handler sits on the container and sees every row's event as
      // it bubbles, so one call here makes the whole list droppable.
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const insertAt = indexForPointer(e.currentTarget, e.clientY, draggingId);

      const list = orderRef.current ?? idsRef.current;
      const without = list.filter((id) => id !== draggingId);
      if (without.length === list.length) return;
      const next = [
        ...without.slice(0, insertAt),
        draggingId,
        ...without.slice(insertAt),
      ];
      // Bailing when nothing moved keeps React from re-rendering on every one
      // of the dozens of dragover events a single gesture fires.
      if (next.every((id, k) => id === list[k])) return;
      applyOrder(next);
    },
    [disabled, draggingId, indexForPointer, applyOrder]
  );

  /**
   * Both `onDrop` and `onDragEnd` call this — a drop is always followed by a
   * dragend — so it has to be idempotent for one gesture. `committing` is that
   * latch: without it the second call would still see the held preview, still
   * diff it against props the refresh had not reached yet, and write twice.
   */
  const commit = useCallback(() => {
    setDraggingId(null);
    const finalOrder = orderRef.current;
    if (committing.current || !finalOrder) return;

    const current = idsRef.current;
    const changed = finalOrder.some((id, i) => id !== current[i]);
    if (!changed) {
      applyOrder(null);
      return;
    }
    // Preview stays up; the effects above release it once the write settles.
    committing.current = true;
    onCommitRef.current(finalOrder);
  }, [applyOrder]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      commit();
    },
    [commit]
  );

  /**
   * Fires at the end of every gesture, after `onDrop` when there was one.
   *
   * It has to be able to commit, because `drop` is not guaranteed. Reordering
   * live means the row under the cursor keeps changing identity, and each
   * change fires dragleave/dragenter; when the pointer comes to rest on a row
   * that never received its own dragover, Chrome refuses the drop and this is
   * the only event that arrives. (Measured, and not a timing fluke: a 400ms
   * pause before releasing does not make the drop fire.) Committing only on
   * `drop` therefore loses real reorders — the exact bug being fixed here.
   *
   * So the fallback commits, gated on the pointer having ended inside the
   * list. A release out over the page is a cancel and is discarded.
   *
   * Known limit: Escape mid-drag also ends inside the list and will save. The
   * browser fires dragend BEFORE the Escape keyup (keydown is swallowed by the
   * drag loop entirely), so there is nothing to distinguish it by at the time
   * the decision has to be made. Saving an order the curator can drag back is
   * the better failure than silently dropping one they meant to keep.
   */
  const onDragEnd = useCallback(
    (e: React.DragEvent) => {
      setDraggingId(null);
      // `onDrop` already handled this gesture.
      if (committing.current) return;

      const el = containerRef.current;
      const rect = el?.getBoundingClientRect();
      const endedOverList =
        !!rect &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (endedOverList) commit();
      else applyOrder(null);
    },
    [commit, applyOrder]
  );

  return {
    /** The items in their current (possibly mid-drag) order. */
    ordered,
    draggingId,
    /** Spread onto each row; `id` is that row's id. */
    rowProps: (id: string) => ({
      draggable: !disabled,
      onDragStart: onDragStart(id),
      onDragEnd,
    }),
    /**
     * Spread onto the <ul>/<tbody>, whose direct children must be the rows.
     * Required: this is where the drop is accepted and the order computed.
     */
    containerProps: {
      ref: setContainer,
      onDragOver,
      onDrop,
    },
  };
}
