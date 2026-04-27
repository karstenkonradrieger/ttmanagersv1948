import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trophy } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  /** Current bestOf (number of sets needed to win, e.g. 2 = Best-of-3, 3 = Best-of-5) */
  bestOf: number;
  /** Update handler — receives new bestOf value (2 or 3) */
  onUpdateBestOf: (bestOf: number) => void | Promise<void>;
  /** Short context label, e.g. "vor der K.O.-Runde" or "vor dem Finale" */
  context: string;
  /** Visual size */
  size?: 'sm' | 'default';
}

/**
 * Compact selector that lets the user switch tournament-wide best-of mode
 * (Best-of-3 ↔ Best-of-5) at key transition points (before KO, before final).
 * Affects only matches that have not started yet — already played matches keep their result.
 */
export function BestOfSwitcher({ bestOf, onUpdateBestOf, context, size = 'sm' }: Props) {
  const [pending, setPending] = useState(false);

  const handleChange = async (next: 2 | 3) => {
    if (next === bestOf || pending) return;
    setPending(true);
    try {
      await onUpdateBestOf(next);
      toast.success(`Modus geändert auf Best-of-${next * 2 - 1} (${context})`);
    } catch (e) {
      toast.error('Modus konnte nicht geändert werden');
    } finally {
      setPending(false);
    }
  };

  const btnSize = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2 py-1">
            <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">Modus:</span>
            <div className="inline-flex rounded-md overflow-hidden border border-border/50">
              <Button
                type="button"
                variant={bestOf === 2 ? 'default' : 'ghost'}
                onClick={() => handleChange(2)}
                disabled={pending}
                className={`${btnSize} rounded-none border-0`}
              >
                Bo3
              </Button>
              <Button
                type="button"
                variant={bestOf === 3 ? 'default' : 'ghost'}
                onClick={() => handleChange(3)}
                disabled={pending}
                className={`${btnSize} rounded-none border-0`}
              >
                Bo5
              </Button>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p className="font-semibold mb-1">Gewinnsätze ändern ({context})</p>
          <p className="text-muted-foreground">
            Wechsle zwischen Best-of-3 (2 Gewinnsätze) und Best-of-5 (3 Gewinnsätze).
            Die Änderung wirkt nur auf Spiele, die noch nicht begonnen wurden — bereits gespielte Sätze bleiben unverändert.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
