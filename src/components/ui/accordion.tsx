import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Accordion({
  items,
  className,
  defaultOpen = 0,
}: {
  items: Array<{ question: string; answer: string }>;
  className?: string;
  defaultOpen?: number;
}) {
  return (
    <div className={cn("divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white", className)}>
      {items.map((item, index) => (
        <details key={item.question} open={index === defaultOpen} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left text-[15px] font-medium text-ink transition-colors hover:bg-soft/60">
            <span>{item.question}</span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-muted transition-transform duration-300 ease-premium group-open:rotate-45 group-open:border-primary group-open:text-primary">
              <Plus className="h-4 w-4" aria-hidden />
            </span>
          </summary>
          <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
