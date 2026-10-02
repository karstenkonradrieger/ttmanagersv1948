# Umsetzungsplan: Hallenlesbarkeit und Tablet-Bedienung

## Ziel und Abgrenzung

Die dunkle Marineblau-/Smaragdgrün-Gestaltung bleibt erhalten. Die Bedienung bei hellem Hallenlicht wird kontrastreicher und auf iPads im Hoch- und Querformat treffsicherer. Turnierlogik bleibt unverändert; einzige Logik-Korrektur ist die Siegerhervorhebung bei „Best of 3“. Ein heller Hallenmodus gehört ausdrücklich **nicht** zu diesem Schritt.

## 1. Farben und Kontraste zuerst

In `src/index.css` die vorhandenen semantischen Farben anpassen und neue Statusfarben ergänzen; in `tailwind.config.ts` ihre Tailwind-Zuordnung und den tokenbasierten Puls definieren. Die folgenden Werte sind HSL und die Kontrastverhältnisse für **deckende** Farben berechnet:

| Token | Geplanter Wert | Erwarteter Kontrast |
| --- | --- | --- |
| `--background` | `222 47% 11%` (unverändert) | Referenzfläche |
| `--card`, `--popover`, `--sidebar-accent` | `222 38% 17%` (bereits vorhanden) | Karte/Hintergrund **1,17:1** |
| `--secondary`, `--muted` | `222 28% 23%` | Fläche/Karte **1,23:1** |
| `--input` | `222 20% 53%` | Eingaberahmen/Sekundärfläche **3,04:1**, Eingaberahmen/Karte **3,75:1** |
| `--border`, `--sidebar-border` | `222 20% 53%` | Rahmen/Sekundärfläche **3,04:1**, Rahmen/Karte **3,75:1** |
| `--muted-foreground` | `215 22% 68%` (beibehalten) | Text/Sekundärfläche **5,28:1** |
| `--destructive` | `0 72% 45%` | bestehende helle Schrift/Rot **5,55:1** |
| `--status-free` | `160 84% 39%` | Grün/Sekundärfläche **4,78:1** |
| `--status-busy`, `--status-waiting` | `38 92% 48%` | Bernstein/Sekundärfläche **5,35:1** |
| `--status-error` | `0 72% 70%` | roter Statustext/Sekundärfläche **4,50:1** |
| `--winner` | `43 96% 56%` (Alias von `--tt-gold`) | Gold/Sekundärfläche **7,34:1** |

**Wichtige Präzisierung:** Bei nur 23 % Helligkeit erreicht die *Füllung* des Eingabefeldes gegenüber der Karte keine 3:1; die sichtbare **Eingabefeld-Grenze** erreicht sie mit dem helleren `--input`-Rahmen. Etwa 32 % beim Rahmen ergäben nur **1,76:1** zur Karte und **1,43:1** zur Sekundärfläche. Deshalb ist der geplante Rahmen bewusst heller als die grobe 32-%-Richtung. Eingaben mit `bg-background` und solche mit `bg-secondary` werden gegen ihre tatsächlichen Umgebungen geprüft; keine flächendeckende Änderung der Formularlogik. Transparente Ränder und Fokuszustände gesondert kontrollieren, weil ihre effektiven Kontraste niedriger sind. `.glass` statt festem HSL aus dem Hintergrund-Token ableiten; `pulse-glow` in `tailwind.config.ts` an `--primary` binden. Tokenwerte in `:root` belassen und auf semantische Klassen setzen, damit eine spätere helle `.dark`/Standard-Thematik ohne neue hartcodierte Statusfarben ergänzt werden kann; keinen hellen Modus jetzt einführen.

## 2. Statusanzeigen und Sieger

In `src/components/MatchScoring.tsx` freie Tisch-Chips grün mit „Frei“/passendem Symbol, belegte bernstein mit „Belegt“/passendem Symbol markieren; Wartezeit und Pause in Bernstein statt Rot. Siegerzahlen, Siegername und Pokal-Kontext goldfarben markieren. In `src/pages/Index.tsx` die feste Bernsteinfarbe am Rückgängig-Button durch den Status-Token ersetzen. Zur konsistenten Statusdarstellung auch vorhandene Bernstein-Statusanzeigen in `src/components/TournamentOverview.tsx`, `src/components/TournamentSettingsDialog.tsx` und `src/components/GroupStageView.tsx` auf denselben Token umstellen, ohne Bedeutung oder Verhalten zu ändern. Keine Farbe als einziges Informationsmerkmal einsetzen.

## 3. Touch- und Tablet-Layout

- `src/components/MatchScoring.tsx`: „11“, „−“ und „+“ je mindestens **44 × 44 px** bei mindestens **16 px** Schrift, mit festen quadratischen Flächen und genug Breite für beide Spielerseiten; bestehende Satzeingabe und Tastatursteuerung beibehalten. „Korrigieren“, „Spielbericht“, „Abbrechen“ und Verzögerungsfelder ebenfalls mindestens 44 px hoch; abgeschlossene Spiele bei langen Namen/Aktionen umbrechen lassen.
- Laufende und anstehende Spielkarten in den jeweiligen Bereichen ab `md` (**768 px**) zweispaltig, darunter einspaltig; die bestehende Gruppen-/K.-o.-Gliederung behalten und die Raster innerhalb der jeweiligen Phase anwenden. Auf engem Tablet-Hochformat und bei langen Namen auf Überläufe prüfen.
- `src/pages/Index.tsx`: „Start“, „Zurücksetzen“, „Zurück“ sowie alle drei Schaltflächen „im neuen Fenster“ auf mindestens 44 px Höhe. Entsprechende Fenster-Schaltflächen in `src/components/DoublesManager.tsx` und `src/components/TournamentMediaTab.tsx` ebenfalls vergrößern.
- Alle lesbaren `text-[10px]`/`text-[11px]` auf mindestens `text-xs` anheben und dabei Platz/Umbruch prüfen: `src/pages/{Index,GroupBracketView}.tsx` sowie `src/components/{BestOfSwitcher,ClubManager,ClubPlayersManager,ClubRoleBadge,ClubRoleHistory,ClubRoles,CreateTournamentWizard,DoubleEliminationBracket,GroupStageView,KaiserScoring,LiveDashboard,MatchPhotos,MatchScoring,PlaylistManager,SwissStandings,TournamentBracket,TournamentOverview,TournamentSelector,TournamentSettingsDialog,VideoThumbnail}.tsx`. Dekorative Icons bleiben in ihrer sinnvollen Größe; keine Steuerung verkleinern.

## 4. Eingabemodus und einziger Bugfix

Den Tastatur-Tipp in `ScoreEntry` nur bei `(hover: hover)` anzeigen; Touch-Geräte sehen weiterhin die normalen Eingabefelder und großen Tasten. Die `.interactive-card`-Effekte sind in `src/index.css` bereits auf Hover-Geräte begrenzt; diesen Zustand bewahren und auf iPad überprüfen. In `ScoreEntry` die beiden festen Prüfungen `p1Wins >= 3` und `p2Wins >= 3` durch `>= effectiveBestOf` ersetzen; die vorhandene Berechnung von `effectiveBestOf` nicht ändern.

## 5. Abnahme

Kontraste nach den finalen Tokenwerten neu rechnen, auch für Rahmen neben `--secondary` sowie Text auf gedämpften Flächen. Angemeldet am laufenden Turnier im Browser bei iPad-Hochformat, iPad-Querformat und 320 px prüfen: Karten und Formulare unterscheidbar, Zwei-Spalten-/Ein-Spalten-Wechsel, keine überdeckten Namen/Tasten, Trefferflächen mindestens 44 px, Touch-Tipp verborgen und Siegerzahl in Best of 3 korrekt. Relevante UI-/Scoring-Tests ergänzen, bestehende Tests und TypeScript-Prüfung ausführen. Keine Änderungen an Auslosung, Spielablauf, Speicherung oder Authentifizierung.