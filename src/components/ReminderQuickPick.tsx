import { ReminderTimeEditor } from "./DateTimePickUI";

type Props = {
  reminderAt: string | null;
  onChange: (iso: string | null) => void;
  compact?: boolean;
};

export function ReminderQuickPick({
  reminderAt,
  onChange,
  compact = false,
}: Props) {
  return (
    <ReminderTimeEditor
      reminderAt={reminderAt}
      onChange={onChange}
      compact={compact}
    />
  );
}
