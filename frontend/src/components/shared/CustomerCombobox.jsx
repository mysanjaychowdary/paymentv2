import { useState } from "react";
import { CaretUpDown, Check } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CustomerCombobox({ customers, value, onChange, testId }) {
  const [open, setOpen] = useState(false);
  const selected = customers.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          data-testid={testId}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
        >
          {selected ? `${selected.name}${selected.company_name ? " · " + selected.company_name : ""}` : "Select customer"}
          <CaretUpDown size={16} className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0">
        <Command>
          <CommandInput placeholder="Search customers..." data-testid="customer-combobox-search" />
          <CommandList>
            <CommandEmpty>No customer found.</CommandEmpty>
            <CommandGroup>
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.company_name || ""}`}
                  data-testid={`customer-option-${c.id}`}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check size={16} className={cn("mr-2", value === c.id ? "opacity-100" : "opacity-0")} />
                  <div>
                    <div>{c.name}</div>
                    {c.company_name ? <div className="text-xs text-muted-foreground">{c.company_name}</div> : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
