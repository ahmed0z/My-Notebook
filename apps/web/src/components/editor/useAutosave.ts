import { useEffect, useRef, useState } from 'react';

export function useAutosave<T>(
  value: T,
  onSave: (val: T) => Promise<void> | void,
  delayMs: number = 1200
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const isFirstRender = useRef(true);
  const latestValue = useRef(value);
  latestValue.current = value;
  const latestOnSave = useRef(onSave);
  latestOnSave.current = onSave;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSaving(true);
        await latestOnSave.current(latestValue.current);
        setLastSaved(new Date());
      } catch (err) {
        console.error('Autosave error', err);
      } finally {
        setIsSaving(false);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return { isSaving, lastSaved };
}
