type LabelArgs = {
  isFocused: boolean;
  isSelected: boolean;
  isLoading?: boolean;
};

const theme = {
  styles: {
    container: () => ({
      flexDirection: "column" as const,
    }),
    option: (_args: { isFocused: boolean }) => ({
      gap: 1,
    }),
    selectedIndicator: () => ({
      color: "green",
    }),
    focusIndicator: () => ({
      color: "blue",
    }),
    label({ isFocused, isSelected, isLoading }: LabelArgs) {
      let color: string;
      if (isSelected) {
        color = "green";
      } else if (isLoading) {
        color = "gray";
      } else {
        color = "cyan";
      }
      if (isFocused && !isSelected) {
        color = isLoading ? "gray" : "cyan";
      }
      return { color };
    },
    highlightedText: () => ({
      bold: true,
    }),
  },
};

export const styles = theme.styles;
export default theme;
