/**
 * usePolling
 *
 * Runs `callback` immediately and then every `intervalMs` milliseconds,
 * but only while the screen is focused AND the app is in the foreground.
 *
 * Usage:
 *   usePolling(loadOrders, 15_000);   // refresh every 15 s
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

export function usePolling(callback: () => void | Promise<void>, intervalMs: number) {
  const savedCallback = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFocused = useRef(false);

  // Keep the ref up-to-date so we don't need intervalMs in deps
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const start = useCallback(() => {
    // Run once immediately then schedule
    savedCallback.current();
    timerRef.current = setInterval(() => {
      savedCallback.current();
    }, intervalMs);
  }, [intervalMs]);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start / stop based on screen focus
  useFocusEffect(
    useCallback(() => {
      isFocused.current = true;
      start();
      return () => {
        isFocused.current = false;
        stop();
      };
    }, [start, stop])
  );

  // Pause while app is backgrounded, resume when it comes back
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (!isFocused.current) return;
      if (nextState === 'active') {
        stop();
        start();
      } else {
        stop();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [start, stop]);
}
