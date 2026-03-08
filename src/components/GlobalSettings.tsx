import { Settings, Mic } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnnouncementPhraseManager } from '@/components/AnnouncementPhraseManager';

export function GlobalSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <Settings className="h-5 w-5" />
          Allgemeine Einstellungen
        </h2>
        <p className="text-sm text-muted-foreground">
          Einstellungen, die für alle Turniere gelten.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4" />
            Durchsage-Stimmen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Nimm natürliche Sprachaufnahmen für die Turnier-Durchsagen auf. Diese Aufnahmen ersetzen die synthetische Stimme und gelten für alle Turniere.
          </p>
          <AnnouncementPhraseManagerInline />
        </CardContent>
      </Card>
    </div>
  );
}

// Inline version that renders directly (not as a dialog trigger)
function AnnouncementPhraseManagerInline() {
  return <AnnouncementPhraseManager inline />;
}
