export type SelectOption<T extends string = string> = {
  label: string;
  value: T;
  isLoading?: boolean;
};

export type OptionMapItem<T extends string = string> = SelectOption<T> & {
  previous?: OptionMapItem<T>;
  next?: OptionMapItem<T>;
  index: number;
};

export default class OptionMap<T extends string = string> extends Map<
  string,
  OptionMapItem<T>
> {
  first?: OptionMapItem<T>;

  constructor(options: ReadonlyArray<SelectOption<T>>) {
    const items: Array<[string, OptionMapItem<T>]> = [];
    let firstItem: OptionMapItem<T> | undefined;
    let previous: OptionMapItem<T> | undefined;
    let index = 0;
    for (const option of options) {
      const item: OptionMapItem<T> = {
        ...option,
        previous,
        next: undefined,
        index,
      };
      if (previous) {
        previous.next = item;
      }
      if (!firstItem) {
        firstItem = item;
      }
      items.push([option.value, item]);
      index++;
      previous = item;
    }
    super(items);
    this.first = firstItem;
  }
}
