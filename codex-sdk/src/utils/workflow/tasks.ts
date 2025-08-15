import type { TaskItem } from "../../workflow";

export function coerceTaskItems(input: string | TaskItem | Array<string | TaskItem>): Array<TaskItem> {
  const list = Array.isArray(input) ? input : [input];
  return list.map((t) => (typeof t === "string" ? { completed: false, label: t } : { completed: t.completed, label: t.label }));
}

export function toggleTaskAtIndex(list: ReadonlyArray<TaskItem>, index: number): Array<TaskItem> {
  if (index < 0 || index >= list.length) {return [...list];}
  const copy = [...list];
  const current = copy[index];
  if (!current) {return copy;}
  copy[index] = { ...current, completed: !current.completed };
  return copy;
}

export function toggleNextIncomplete(list: ReadonlyArray<TaskItem>): Array<TaskItem> {
  const idx = list.findIndex((t) => !t.completed);
  if (idx === -1) {return [...list];}
  return toggleTaskAtIndex(list, idx);
}


