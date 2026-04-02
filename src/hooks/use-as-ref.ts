import { useRef } from "react";

/**
 * Keeps a ref that always points to the latest value.
 * Useful for accessing current values in callbacks without re-creating them.
 */
export function useAsRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
