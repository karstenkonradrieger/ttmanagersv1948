# Umsetzungsplan: Kontrast-Abgleich und AI-Turnierzusammenfassung

## Ziel
Die tatsächlich gerenderten Karten, Eingabefelder und Schaltflächen werden gegen die WCAG-Ziele aus dem Auftrag geprüft und dort korrigiert, wo Transparenz die nominellen Tokenwerte abschwächt. Veranstalter können abgeschlossene Ergebnisse wie bisher eingeben oder korrigieren und daraus eine kurze Zuschauer-Zusammenfassung erzeugen, speichern, teilen und in der öffentlichen Live-Ansicht anzeigen.

## 1. Kontrastwerte prüfen und gezielt angleichen

Die aktuellen deckenden Tokenwerte ergeben:

| Kombination | Ist | Ziel | Bewertung |
| --- | ---: | ---: | --- |
| Karte `222 38% 17%` auf Hintergrund `222 47% 11%` | 1,17:1 | klare Flächenstaffelung | als Fläche allein schwach; sichtbarer Rahmen nötig |
| Sekundärfläche `222 28% 23%` auf Karte | 1,23:1 | klare Eingabefläche | Fläche allein schwach; Eingaberahmen trägt die Abgrenzung |
| Rahmen/Eingabe `222 20% 53%` auf Sekundärfläche | 3,04:1 | mindestens 3:1 | erfüllt |
| Rahmen/Eingabe auf Karte | 3,75:1 | mindestens 3:1 | erfüllt |
| Gedämpfter Text `215 22% 68%` auf Sekundärfläche | 5,28:1 | mindestens 4,5:1 | erfüllt |
| Primärtext `222 47% 8%` auf Grün `160 84% 39%` | 7,30:1 | mindestens 4,5:1 | erfüllt |
| Heller Text auf Rot `0 72% 45%` | 5,55:1 | mindestens 4,5:1 | erfüllt |

Transparente Flächen schwächen den tatsächlichen Unterschied: `bg-card/50` auf dem Hintergrund erreicht nur etwa 1,08:1, `bg-secondary/50` etwa 1,18:1. Auch `text-muted-foreground/70` auf Karten fällt auf etwa 3,95:1. Deshalb werden wichtige Karten deckend und mit sichtbarem Token-Rahmen dargestellt; schwach transparente kleine Texte werden auf deckende Text-Tokens angehoben. Eingaben behalten den 53%-Rahmen. Primär-, Sekundär- und Destructive-Buttons werden in ihren normalen, Hover-, Fokus- und Disabled-Zuständen geprüft; Disabled bleibt als nicht-interaktiver Zustand erkennbar, aber lesbar.

Betroffene Dateien: `src/index.css`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx` sowie nur die konkreten Karten-/Textstellen in `src/components/MatchScoring.tsx`, `src/pages/Index.tsx` und der neuen Zusammenfassungsansicht.

## 2. Ergebnisdaten für die Zusammenfassung vorbereiten

Die vorhandene Satzeingabe in „Ergebnis“ bleibt die einzige Quelle abgeschlossener Resultate. Die neue Funktion verwendet ausschließlich gespeicherte, abgeschlossene Spiele und übermittelt keine Kontaktdaten. Aus Turniername, Modus, Rundenbezeichnung, Spielernamen/Vereinen, Satzständen und Gewinnern wird serverseitig ein kompakter Datensatz gebildet.

Eine neue gespeicherte Turnier-Zusammenfassung erhält Text, Erstellungszeitpunkt und den Stand der zuletzt berücksichtigten Ergebnisse. Ändert sich danach ein Ergebnis, zeigt die Oberfläche die vorhandene Zusammenfassung als veraltet, statt sie stillschweigend als aktuell auszugeben.

Betroffene Dateien: neue Datenbankmigration, `src/types/tournament.ts`, `src/services/tournamentService.ts`, `src/hooks/useTournamentDb.ts` und generierte Backend-Typen über den vorgesehenen Cloud-Workflow.

## 3. Sichere Lovable-AI-Erzeugung

Eine neue Serverfunktion authentifiziert den Veranstalter, prüft dessen Zugriff auf das Turnier, lädt die gespeicherten abgeschlossenen Spiele serverseitig und ruft den AI Gateway mit `openai/gpt-6-astra` über die Responses API auf. Prompt, Zugangsschlüssel und Modellaufruf bleiben vollständig serverseitig. Die Ausgabe wird auf eine kurze, sachliche, teilbare deutsche Zuschauer-Zusammenfassung begrenzt; das Modell darf keine Ergebnisse erfinden.

Die Anfrage wird gestreamt verarbeitet, ohne künstlichen Timeout. 400/401/402/403/429/5xx werden nach Gateway-Vorgabe unterschieden und mit der sicheren Fehlermeldung in der Oberfläche angezeigt. Nur authentifizierte Turnierverantwortliche dürfen erzeugen; die gespeicherte fertige Zusammenfassung darf über die bestehende öffentliche Turnier-Leseansicht erscheinen.

Betroffene Dateien: neue Funktion unter `supabase/functions/`, gemeinsame serverseitige Gateway-Helfer unter `supabase/functions/_shared/`; AI-SDK-Abhängigkeiten laufen nur dort.

## 4. Bedienung, Teilen und Live-Anzeige

Im Bereich der abgeschlossenen Spiele erscheint ein kompakter Abschnitt „Turnierzusammenfassung“:

- „Mit Lovable AI erstellen“ ist erst aktiv, wenn mindestens ein vollständiges Ergebnis gespeichert ist.
- Während der Erstellung gibt es einen klaren Ladezustand; bei Fehlern bleibt die bestehende Zusammenfassung erhalten.
- Nach der Erstellung kann der Text über die native Teilen-Funktion des Geräts geteilt werden; als Fallback wird er in die Zwischenablage kopiert.
- „Neu erstellen“ aktualisiert bewusst auf Basis des aktuellen Ergebnisstands.
- Die öffentliche Live-Ansicht zeigt die gespeicherte Zusammenfassung mit Erstellungszeitpunkt. Ist sie nach einer Ergebniskorrektur veraltet, wird sie dort nicht als aktueller Bericht ausgegeben.

Betroffene Dateien: neue fokussierte UI-Komponente, `src/components/MatchScoring.tsx`, `src/pages/Index.tsx` und `src/pages/LiveView.tsx` beziehungsweise dessen bestehende Live-Komponente.

## 5. Prüfungen und Abnahme

1. Kontrastberechnung für alle final verwendeten deckenden und transparenten Kombinationen dokumentieren; Text mindestens 4,5:1, Eingabe-/Fokusränder mindestens 3:1.
2. Tests für Payload-Aufbereitung, „keine abgeschlossenen Ergebnisse“, veraltete Zusammenfassung sowie Teilen-/Kopieren-Fallback ergänzen.
3. Die Serverfunktion mit einer echten authentifizierten Gateway-Anfrage testen und Antwort sowie Fehlerstatus prüfen.
4. End-to-end prüfen: Ergebnis abschließen oder korrigieren → Zusammenfassung erzeugen → speichern → teilen → öffentliche Live-Ansicht öffnen.
5. Tablet-Hochformat, Tablet-Querformat und 320 px auf Überläufe, 44-px-Bedienflächen und lesbare Zustände prüfen.

## Reihenfolge

1. Kontraste korrigieren und erneut messen.
2. Persistenz und Berechtigungen ergänzen.
3. Serverfunktion und Gateway-Aufruf implementieren und live testen.
4. Veranstalter-Ansicht, Teilen und Live-Anzeige ergänzen.
5. Tests und vollständigen Browser-Ablauf durchführen.
