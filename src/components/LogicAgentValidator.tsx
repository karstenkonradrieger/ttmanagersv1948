import { useState } from 'react';
import { Player } from '@/types/tournament';
import { validateSeeding, ValidationError } from '@/services/validationService';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
    players: Player[];
}

export function LogicAgentValidator({ players }: Props) {
    const [issues, setIssues] = useState<ValidationError[] | null>(null);

    const handleValidate = () => {
        const findings = validateSeeding(players);
        setIssues(findings);
    };

    return (
        <div className="bg-secondary/50 rounded-lg p-4 space-y-4 mb-4 border border-border animate-slide-up">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-bold flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-primary" /> Logic Agent: Setzlisten-Prüfung
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Prüft die aktuelle Setzliste auf TTR-Fehler und fehlende Daten.</p>
                </div>
                <Button onClick={handleValidate} size="sm" variant="outline" className="gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Setzliste prüfen
                </Button>
            </div>

            {issues !== null && (
                <div className="space-y-2 mt-4 animate-slide-up">
                    {issues.length === 0 ? (
                        <Alert className="bg-green-500/10 border-green-500/50 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4 stroke-current" />
                            <AlertTitle>Alles in Ordnung!</AlertTitle>
                            <AlertDescription>Die Setzliste erfüllt alle Validierungsregeln.</AlertDescription>
                        </Alert>
                    ) : (
                        issues.map((issue, idx) => (
                            <Alert
                                key={idx}
                                variant={issue.type === 'error' ? 'destructive' : 'default'}
                                className={issue.type === 'warning' ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : ""}
                            >
                                {issue.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4 stroke-current" />}
                                <AlertTitle>{issue.type === 'error' ? 'Fehler' : 'Warnung'}</AlertTitle>
                                <AlertDescription>{issue.message}</AlertDescription>
                            </Alert>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
