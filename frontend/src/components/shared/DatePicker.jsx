import { CalendarBlank } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DatePicker({ value, onChange, placeholder = "Select date", testId, disabled }) {
  const selected = value ? new Date(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-testid={testId}
          className={cn("w-full justify-start gap-2 font-normal", !value && "text-muted-foreground")}
        >
          <CalendarBlank size={16} />
          {value ? formatDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && onChange(d.toISOString())}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
