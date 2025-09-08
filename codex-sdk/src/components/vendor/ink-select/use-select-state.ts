import { isDeepStrictEqual } from "node:util";
import { useReducer, useCallback, useMemo, useState, useEffect } from "react";
import OptionMap, { type OptionMapItem, type SelectOption } from "./option-map";

type State<T extends string = string> = {
  optionMap: OptionMap<T>;
  visibleOptionCount: number;
  focusedValue?: T;
  visibleFromIndex: number;
  visibleToIndex: number;
  previousValue: string | null;
  value?: T;
  selectionCount: number;
};

type Action<T extends string = string> =
  | { type: "focus-next-option" }
  | { type: "focus-previous-option" }
  | { type: "select-focused-option" }
  | { type: "reset"; state: State<T> };

const reducer = <T extends string>(
  state: State<T>,
  action: Action<T>,
): State<T> => {
  switch (action.type) {
    case "focus-next-option": {
      if (!state.focusedValue) {
        return state;
      }
      const item = state.optionMap.get(state.focusedValue) as
        | OptionMapItem<T>
        | undefined;
      if (!item) {
        return state;
      }
      const next = item.next;
      if (!next) {
        return state;
      }
      const needsToScroll = next.index >= state.visibleToIndex;
      if (!needsToScroll) {
        return { ...state, focusedValue: next.value };
      }
      const nextVisibleToIndex = Math.min(
        state.optionMap.size,
        state.visibleToIndex + 1,
      );
      const nextVisibleFromIndex =
        nextVisibleToIndex - state.visibleOptionCount;
      return {
        ...state,
        focusedValue: next.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
      };
    }
    case "focus-previous-option": {
      if (!state.focusedValue) {
        return state;
      }
      const item = state.optionMap.get(state.focusedValue) as
        | OptionMapItem<T>
        | undefined;
      if (!item) {
        return state;
      }
      const previous = item.previous;
      if (!previous) {
        return state;
      }
      const needsToScroll = previous.index <= state.visibleFromIndex;
      if (!needsToScroll) {
        return { ...state, focusedValue: previous.value };
      }
      const nextVisibleFromIndex = Math.max(0, state.visibleFromIndex - 1);
      const nextVisibleToIndex =
        nextVisibleFromIndex + state.visibleOptionCount;
      return {
        ...state,
        focusedValue: previous.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
      };
    }
    case "select-focused-option": {
      return {
        ...state,
        previousValue: state.value ?? null,
        value: state.focusedValue,
        selectionCount: (state.selectionCount || 0) + 1,
      };
    }
    case "reset": {
      return action.state;
    }
  }
};

const createDefaultState = <T extends string>({
  visibleOptionCount: customVisibleOptionCount,
  defaultValue,
  options,
}: {
  visibleOptionCount?: number;
  defaultValue?: T;
  options: ReadonlyArray<SelectOption<T>>;
}): State<T> => {
  const visibleOptionCount =
    typeof customVisibleOptionCount === "number"
      ? Math.min(customVisibleOptionCount, options.length)
      : options.length;
  const optionMap = new OptionMap<T>(options);
  const defaultItem = defaultValue ? optionMap.get(defaultValue) : null;
  const focusedValue = defaultItem
    ? defaultValue
    : (optionMap.first?.value as T | undefined);

  let visibleFromIndex = 0;
  let visibleToIndex = visibleOptionCount;

  if (
    defaultItem &&
    (defaultItem as OptionMapItem).index >= visibleOptionCount
  ) {
    visibleFromIndex = Math.max(
      0,
      (defaultItem as OptionMapItem).index - Math.floor(visibleOptionCount / 2),
    );
    visibleToIndex = Math.min(
      options.length,
      visibleFromIndex + visibleOptionCount,
    );
    visibleFromIndex = visibleToIndex - visibleOptionCount;
  }

  return {
    optionMap,
    visibleOptionCount,
    focusedValue,
    visibleFromIndex,
    visibleToIndex,
    previousValue: null,
    value: defaultValue,
    selectionCount: 0,
  };
};

export const useSelectState = <T extends string>({
  visibleOptionCount = 5,
  options,
  defaultValue,
  onChange,
}: {
  visibleOptionCount?: number;
  options: ReadonlyArray<SelectOption<T>>;
  defaultValue?: T;
  onChange?: (value: T) => void;
}) => {
  const [state, dispatch] = useReducer(
    reducer as unknown as (prev: State<T>, action: Action<T>) => State<T>,
    { visibleOptionCount, defaultValue, options } as any,
    () => createDefaultState<T>({ visibleOptionCount, defaultValue, options }),
  );
  const [lastOptions, setLastOptions] = useState(options);
  const [lastDefaultValue, setLastDefaultValue] = useState(defaultValue);
  const [lastSelectionCount, setLastSelectionCount] = useState(0);

  if (
    (options !== lastOptions && !isDeepStrictEqual(options, lastOptions)) ||
    defaultValue !== lastDefaultValue
  ) {
    dispatch({
      type: "reset",
      state: createDefaultState({ visibleOptionCount, defaultValue, options }),
    });
    setLastOptions(options);
    setLastDefaultValue(defaultValue);
    setLastSelectionCount(0);
  }

  const focusNextOption = useCallback(() => {
    dispatch({ type: "focus-next-option" });
  }, []);

  const focusPreviousOption = useCallback(() => {
    dispatch({ type: "focus-previous-option" });
  }, []);

  const selectFocusedOption = useCallback(() => {
    dispatch({ type: "select-focused-option" });
  }, []);

  const visibleOptions = useMemo(() => {
    return options
      .map((option, index) => ({ ...(option as SelectOption<T>), index }))
      .slice(state.visibleFromIndex, state.visibleToIndex);
  }, [options, state.visibleFromIndex, state.visibleToIndex]);

  useEffect(() => {
    if (
      state.value !== undefined &&
      state.selectionCount !== lastSelectionCount
    ) {
      onChange?.(state.value);
      setLastSelectionCount(state.selectionCount);
    }
  }, [state.value, state.selectionCount, lastSelectionCount, onChange]);

  return {
    focusedValue: state.focusedValue,
    visibleFromIndex: state.visibleFromIndex,
    visibleToIndex: state.visibleToIndex,
    value: state.value,
    visibleOptions,
    focusNextOption,
    focusPreviousOption,
    selectFocusedOption,
  } as const;
};
