import { Player } from '@/types/tournament';

export interface ValidationError {
    type: 'error' | 'warning';
    message: string;
    playerId?: string;
}

export function validateSeeding(players: Player[]): ValidationError[] {
    const issues: ValidationError[] = [];

    if (!players || players.length === 0) return issues;

    // 1. TTR descending check
    let sorted = true;
    for (let i = 0; i < players.length - 1; i++) {
        if (players[i].ttr < players[i + 1].ttr) {
            sorted = false;
            break;
        }
    }
    if (!sorted) {
        issues.push({
            type: 'warning',
            message: 'Setzliste ist nicht strikt nach absteigendem TTR sortiert. Spiele könnten ungleichmäßig verteilt sein.'
        });
    }

    // 2. Missing TTR check
    players.forEach(p => {
        if (!p.ttr || p.ttr === 0) {
            issues.push({
                type: 'error',
                message: `Spieler "${p.name}" hat keinen gültigen TTR-Wert (TTR ist 0 oder fehlt).`,
                playerId: p.id
            });
        }
    });

    // 3. Missing club check
    players.forEach(p => {
        if (!p.club || p.club.trim() === '') {
            issues.push({
                type: 'warning',
                message: `Spieler "${p.name}" hat keinen Verein hinterlegt.`,
                playerId: p.id
            });
        }
    });

    return issues;
}
