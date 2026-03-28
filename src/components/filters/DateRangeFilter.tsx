import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangeFilterProps {
  valueFrom: string | undefined;
  valueTo: string | undefined;
  onChangeFrom: (value: string | undefined) => void;
  onChangeTo: (value: string | undefined) => void;
  placeholderFrom?: string;
  placeholderTo?: string;
  className?: string;
}

export function DateRangeFilter({
  valueFrom,
  valueTo,
  onChangeFrom,
  onChangeTo,
  placeholderFrom = "From",
  placeholderTo = "To",
  className,
}: DateRangeFilterProps) {
  const dateFrom = valueFrom ? new Date(valueFrom) : undefined;
  const dateTo = valueTo ? new Date(valueTo) : undefined;

  return (
    <div className={`grid grid-cols-2 gap-1 ${className ?? ""}`}>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
            />
          }
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateFrom ? format(dateFrom, "yyyy-MM-dd") : placeholderFrom}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateFrom}
            onSelect={(date) =>
              onChangeFrom(date ? format(date, "yyyy-MM-dd") : undefined)
            }
          />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
            />
          }
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateTo ? format(dateTo, "yyyy-MM-dd") : placeholderTo}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateTo}
            onSelect={(date) =>
              onChangeTo(date ? format(date, "yyyy-MM-dd") : undefined)
            }
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
