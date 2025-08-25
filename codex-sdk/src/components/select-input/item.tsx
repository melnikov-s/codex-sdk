import { Text } from "ink";
import React from "react";

export type Props = {
  readonly isSelected?: boolean;
  readonly label: string;
};

function Item({ isSelected = false, label }: Props): JSX.Element {
  return <Text color={isSelected ? "green" : undefined}>{label}</Text>;
}

export default Item;
