const theme = {
  styles: {
    container: () => ({
      flexDirection: "column",
    }),
    option: ({ isFocused }) => ({
      gap: 1,
      paddingLeft: isFocused ? 0 : 2,
    }),
    selectedIndicator: () => ({
      color: "green",
    }),
    focusIndicator: () => ({
      color: "blue",
    }),
    label({ isFocused, isSelected, isLoading }) {
      let color;

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
