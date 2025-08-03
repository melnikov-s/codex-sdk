import { Text } from "ink";
import React, { useEffect, useState } from "react";

interface Props {
  timeoutSeconds: number;
  onTimeout: () => void;
  defaultLabel: string;
}

export function CountdownTimer({ timeoutSeconds, onTimeout, defaultLabel }: Props) {
  const [remaining, setRemaining] = useState(timeoutSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((r) => r - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
     if (remaining <= 0) {
      onTimeout();
      return;
    }
  }, [onTimeout, remaining]);

  return (
    <Text dimColor>
      Auto-selection {defaultLabel} in {remaining}s... (interact to cancel)
    </Text>
  );
}
