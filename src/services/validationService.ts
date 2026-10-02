import { Player } from '@/types/tournament';
import { normalizeClub } from '@/services/clubBalancedGroupDraw';

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

/** Warns about club accumulation inside groups (group phase). */
export function validateClubDistribution(players: Player[]): ValidationError[] {
    const issues: ValidationError[] = [];
    const grouped = players.filter(p => p.groupNumber !== null && p.groupNumber !== undefined && p.groupNumber >= 0);
    if (grouped.length === 0) return issues;
    const groupCount = Math.max(...grouped.map(p => p.groupNumber as number)) + 1;
    const totals = new Map<string, number>();
    const names = new Map<string, string>();
    const perGroup = new Map<number, Map<string, number>>();
    for (const p of grouped) {
        const k = normalizeClub(p.club);
        if (!k) continue;
        if (!names.has(k)) names.set(k, p.club.trim());
        totals.set(k, (totals.get(k) ?? 0) + 1);
        const g = p.groupNumber as number;
        if (!perGroup.has(g)) perGroup.set(g, new Map());
        perGroup.get(g)!.set(k, (perGroup.get(g)!.get(k) ?? 0) + 1);
    }
    for (const [g, m] of perGroup) {
        for (const [k, c] of m) {
            const cap = Math.ceil((totals.get(k) ?? 0) / groupCount);
            if (c > cap) {
                issues.push({
                    type: 'warning',
                    message: `Vereinshäufung in Gruppe ${String.fromCharCode(65 + g)}: „${names.get(k)}“ ist ${c}× vertreten (gleichmäßig wären max. ${cap}).`,
                });
            }
        }
    }
    return issues;
}
