import { useEffect, useState, type SetStateAction } from "react";

type Fields = Record<string, string>;
type SavedDraft<T extends Fields> = {
  schema: 2;
  baseRevisionId: string;
  base: T;
  edits: Partial<T>;
  legacy?: boolean;
};
export type DraftChoice = "latest" | "draft";

function editsFrom<T extends Fields>(base: T, value: T): Partial<T> {
  return Object.fromEntries(
    Object.keys(base)
      .filter((key) => base[key] !== value[key])
      .map((key) => [key, value[key]]),
  ) as Partial<T>;
}
function read<T extends Fields>(
  key: string,
  revisionId: string,
  base: T,
): { saved: SavedDraft<T>; recovered: boolean } {
  const fresh: SavedDraft<T> = {
    schema: 2,
    baseRevisionId: revisionId,
    base,
    edits: {},
  };
  try {
    const raw = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!raw || typeof raw !== "object")
      return { saved: fresh, recovered: false };
    const fields = Object.keys(base);
    if (
      raw.schema === 2 &&
      typeof raw.baseRevisionId === "string" &&
      raw.base &&
      raw.edits &&
      fields.every((field) => typeof raw.base[field] === "string")
    ) {
      const edits = Object.fromEntries(
        fields
          .filter((field) => typeof raw.edits[field] === "string")
          .map((field) => [field, raw.edits[field]]),
      ) as Partial<T>;
      return {
        saved: {
          schema: 2,
          baseRevisionId: raw.baseRevisionId,
          base: Object.fromEntries(
            fields.map((field) => [field, raw.base[field]]),
          ) as T,
          edits,
          ...(raw.legacy ? { legacy: true } : {}),
        },
        recovered: true,
      };
    }
    // Older drafts saved every field without its base revision. Do not infer
    // that unchanged old text was an intentional edit against the latest package.
    const oldValues = Object.fromEntries(
      fields.map((field) => [
        field,
        typeof raw[field] === "string" ? raw[field] : base[field],
      ]),
    ) as T;
    return {
      saved: {
        ...fresh,
        baseRevisionId: "unknown",
        edits: editsFrom(base, oldValues),
        legacy: true,
      },
      recovered: true,
    };
  } catch {
    return { saved: fresh, recovered: false };
  }
}

/** A text draft is a set of edits against one package, not a replacement package. */
export function usePackageDraft<T extends Fields>(
  key: string,
  revisionId: string,
  latest: T,
) {
  const [initial] = useState(() => read(key, revisionId, latest));
  const [saved, setSaved] = useState(initial.saved);
  const [recovered, setRecovered] = useState(initial.recovered);
  const value = { ...saved.base, ...saved.edits } as T;
  const dirty = Object.keys(saved.edits).length > 0;
  const needsReconciliation =
    !!saved.legacy || saved.baseRevisionId !== revisionId;
  const edited = Object.keys(saved.edits) as (keyof T & string)[];
  const conflicts = edited.filter(
    (field) =>
      saved.edits[field] !== latest[field] &&
      (saved.legacy || saved.base[field] !== latest[field]),
  );
  const latestChanges = Object.keys(latest).filter(
    (field) => !saved.legacy && saved.base[field] !== latest[field],
  );
  useEffect(() => {
    try {
      if (dirty || saved.legacy)
        sessionStorage.setItem(key, JSON.stringify(saved));
      else sessionStorage.removeItem(key);
    } catch {
      /* A blocked browser store must not prevent submitting work. */
    }
  }, [key, saved, dirty]);
  function setValue(update: SetStateAction<T>) {
    setSaved((old) => {
      const current = { ...old.base, ...old.edits } as T;
      const next = typeof update === "function" ? update(current) : update;
      return { ...old, edits: editsFrom(old.base, next) };
    });
  }
  function reconcile(choices: Partial<Record<keyof T, DraftChoice>>) {
    if (conflicts.some((field) => !choices[field])) return false;
    const retainedEdits = Object.fromEntries(
      edited
        .filter(
          (field) => !conflicts.includes(field) || choices[field] === "draft",
        )
        .map((field) => [field, saved.edits[field]]),
    );
    const next = { ...latest, ...retainedEdits } as T;
    setSaved({
      schema: 2,
      baseRevisionId: revisionId,
      base: latest,
      edits: editsFrom(latest, next),
    });
    setRecovered(false);
    return true;
  }
  function clear() {
    setSaved({
      schema: 2,
      baseRevisionId: revisionId,
      base: latest,
      edits: {},
    });
    setRecovered(false);
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* optional */
    }
  }
  return {
    value,
    setValue,
    dirty,
    recovered,
    clear,
    needsReconciliation,
    conflicts,
    latestChanges,
    base: saved.base,
    baseRevisionId: saved.baseRevisionId,
    legacy: !!saved.legacy,
    reconcile,
  };
}
