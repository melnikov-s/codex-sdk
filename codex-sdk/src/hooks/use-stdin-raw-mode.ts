import { useEffect } from "react";

export function useStdinRawMode(): void {
  useEffect(() => {
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(true);
      } catch {
        // ignore
      }
    }
  }, []);
}


