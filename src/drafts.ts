import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

const drafts = new Map<string, unknown>();
const changed = new Set<string>();
const storageKey = (key: string) => `clearpath-draft:${key}`;

// Text survives refresh in this tab. Files stay in memory and need reselecting
// after a reload; warn before allowing the browser to discard them.
export function useDraftState<T>(
  key: string,
  initial: T | (() => T),
  memoryOnly = false,
): [T, Dispatch<SetStateAction<T>>] {
  const baseline = useRef(
    JSON.stringify(
      typeof initial === "function" ? (initial as () => T)() : initial,
    ),
  );
  const [value, setValue] = useState<T>(() => {
    if (drafts.has(key)) return drafts.get(key) as T;
    if (!memoryOnly) {
      try {
        const saved = sessionStorage.getItem(storageKey(key));
        if (saved) {
          changed.add(key);
          return JSON.parse(saved) as T;
        }
      } catch {
        /* Storage may be disabled; the in-memory draft still works. */
      }
    }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  const update: Dispatch<SetStateAction<T>> = (next) =>
    setValue((previous) => {
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(previous) : next;
      if (JSON.stringify(resolved) === baseline.current) {
        drafts.delete(key);
        changed.delete(key);
        try {
          sessionStorage.removeItem(storageKey(key));
        } catch {
          /* Optional storage. */
        }
        return resolved;
      }
      drafts.set(key, resolved);
      changed.add(key);
      if (!memoryOnly) {
        try {
          sessionStorage.setItem(storageKey(key), JSON.stringify(resolved));
        } catch {
          /* Keep local state. */
        }
      }
      return resolved;
    });
  return [value, update];
}

export function clearDrafts(prefix: string) {
  for (const key of [...drafts.keys(), ...changed]) {
    if (key.startsWith(prefix)) {
      drafts.delete(key);
      changed.delete(key);
    }
  }
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(storageKey(prefix))) sessionStorage.removeItem(key);
    }
  } catch {
    /* No persistent draft to discard. */
  }
}

export function useUnsavedWarning() {
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (changed.size) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
}
