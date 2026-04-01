import { useRef } from "react";

const UNSET = Symbol("UNSET");

/**
 * Like useRef, but accepts an initializer function that runs only once.
 */
export function useLazyRef<T>(init: () => T) {
  const ref = useRef<T | typeof UNSET>(UNSET);
  if (ref.current === UNSET) {
    ref.current = init();
  }
  return ref as React.RefObject<T>;
}
