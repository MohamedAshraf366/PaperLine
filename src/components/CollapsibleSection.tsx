import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  bodyClassName,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-border bg-card"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-6 py-4 text-start">
        <span className="font-display font-semibold">{title}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className={cn(
            "max-h-[28rem] overflow-y-auto border-t border-border px-6 py-4",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
