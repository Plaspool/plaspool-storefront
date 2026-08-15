"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

export interface DebouncedField {
  /** What the input should display right now. */
  value: string;
  /** Wire to `onChange` — updates the display immediately, schedules the write. */
  onChange: (next: string) => void;
  /** Clear the field and cancel any pending write, without writing itself. */
  reset: (next?: string) => void;
}

/**
 * A debouncing text field whose display state is local but whose *applied*
 * value still lives in the URL.
 *
 * The naive shape — an uncontrolled input keyed on the URL value its own
 * debounced handler writes — remounts itself mid-typing and drops the caret.
 * Keeping a local buffer fixes that, but a local buffer alone stops reacting to
 * the back button and to "Clear all".
 *
 * So the hook tracks the last value it caused the URL to hold. When the
 * incoming `external` value differs from that, the change came from somewhere
 * else — history, a reset button, another copy of the rail — and the buffer is
 * resynced. When it matches, the component is only seeing its own echo and the
 * caret is left alone.
 *
 * `commit` returns the string the URL will report back once it has normalised
 * the input (trimmed, integer-parsed), which is what makes the echo test exact.
 */
export function useDebouncedField({
  external,
  delay,
  commit,
}: {
  external: string;
  delay: number;
  commit: (raw: string) => string;
}): DebouncedField {
  const [value, setValue] = useState(external);
  const lastWritten = useRef(external);

  const write = useDebouncedCallback((raw: string) => {
    lastWritten.current = commit(raw);
  }, delay);

  useEffect(() => {
    if (external === lastWritten.current) return;
    lastWritten.current = external;
    write.cancel();
    setValue(external);
  }, [external, write]);

  const onChange = useCallback(
    (next: string) => {
      setValue(next);
      write(next);
    },
    [write],
  );

  const reset = useCallback(
    (next = "") => {
      write.cancel();
      lastWritten.current = next;
      setValue(next);
    },
    [write],
  );

  return { value, onChange, reset };
}
