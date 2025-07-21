import { Text } from "ink";
import React, { useEffect, useState } from "react";

interface Props {
  timeoutSeconds: number;
  onTimeout: () => void;
  onCancel: () => void;
}

export function CountdownTimer({ timeoutSeconds, onTimeout, onCancel }: Props) {
  const [remaining, setRemaining] = useState(timeoutSeconds);

  useEffect(() => {
    if (remaining <= 0) {
      onTimeout();
      return;
    }

    const timer = setTimeout(() => {
      setRemaining(remaining - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [remaining, onTimeout]);

  useEffect(() => {
    return () => onCancel();
  }, [onCancel]);

  return (
    <Text dimColor>
      Auto-selecting default in {remaining}s... (interact to cancel)
    </Text>
  );
}
