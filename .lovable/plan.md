# Turnierfragen mit Lovable AI

## Ziel
Turnierveranstalter erhalten im Bereich der abgeschlossenen Spiele einen kompakten Fragebereich. Dort können sie natürliche Fragen zu gespeicherten Ergebnissen und zum bisherigen Turnierverlauf stellen. Pro Turnier gibt es genau ein dauerhaft in der Datenbank gespeichertes Gespräch.

## Umsetzung

1. **Geschützten Gesprächsverlauf speichern**
   - Eine Tabelle für Nachrichten mit Turnierbezug, Rolle, Inhalt, Erstellungszeit und Benutzerbezug ergänzen.
   - Datenzugriff ausschließlich für den angemeldeten Ersteller des jeweiligen Turniers erlauben; keine öffentliche Lesbarkeit und keine personenbezogenen Profildaten in Antworten aufnehmen.
   - Explizite Datenbankrechte, Row-Level-Security und automatisches Löschen beim Löschen des Turniers vorsehen.

2. **Serverseitige AI-Fragefunktion ergänzen**
   - Eine geschützte Serverfunktion erstellen, die Anmeldung und Turnier-Eigentümerschaft prüft.
   - Aktuelle Turnierdaten serverseitig laden: Turniermodus/-phase, Teilnehmernamen und Vereine, Doppel/Teams, abgeschlossene und laufende Begegnungen sowie Satzergebnisse; bei Mannschaftswettbewerben auch gespeicherte Einzelbegegnungen einbeziehen.
   - Den bestehenden Lovable-AI-Gateway-Aufbau mit `openai/gpt-6-astra`, Responses API, Streaming, Run-ID-Weitergabe, `store: false` und den vorgeschriebenen Reasoning-Optionen wiederverwenden.
   - Modell strikt auf die gelieferten Turnierdaten begrenzen: Unsicherheit offen benennen, nichts erfinden und bei nicht beantwortbaren Fragen klar darauf hinweisen.
   - Frage und vollständig erzeugte Antwort erst nach erfolgreicher Ausgabe gemeinsam dem einen Turniergespräch zuordnen; sichere Gateway-Fehlermeldungen unverändert an die Oberfläche weitergeben.

3. **Fragebereich in die Ergebnisansicht integrieren**
   - Unter der bestehenden Turnierzusammenfassung einen klar getrennten Bereich „Turnierdaten fragen“ ergänzen.
   - Gespeicherten Verlauf laden, Benutzerfragen und AI-Antworten gut unterscheidbar darstellen und während der Antwort sofort Frage plus Ladeanzeige zeigen.
   - Mehrzeilige Eingabe, Senden per Schaltfläche, automatisches Scrollen, Fokusführung und mindestens 44 px große Touch-Ziele für Smartphone und Tablet umsetzen.
   - Das bestehende dunkle Marine-/Grün-/Gold-System und die WCAG-konformen Formular-Tokens verwenden; keine öffentliche Anzeige dieses internen Gesprächs in der Live-Ansicht.
   - Eine bewusst bestätigte Aktion „Verlauf löschen“ anbieten; es gibt keine Thread-Liste, weil genau ein Gespräch je Turnier gewünscht ist.

4. **Synchronisierung und Aktualität**
   - Gespeicherte Nachrichten über Realtime-Aktualisierungen zwischen geöffneten Veranstalter-Tabs synchron halten.
   - Jede neue Frage gegen den aktuellen Datenbankstand beantworten, damit korrigierte Ergebnisse und neue Spiele unmittelbar berücksichtigt werden.
   - Einen kurzen Hinweis anzeigen, dass Antworten ausschließlich auf den aktuell gespeicherten Turnierdaten beruhen.

5. **Prüfung**
   - Rechte testen: Veranstalter darf fragen/lesen/löschen; fremde und abgemeldete Benutzer erhalten keinen Verlauf und keine AI-Antwort.
   - Tests für Datenaufbereitung, Turnierabgrenzung, leere/zu lange Fragen, Persistenz, Löschung und sichere Fehlerdarstellung ergänzen.
   - Den echten Gateway-Aufruf mit einem Turnier mit abgeschlossenen Ergebnissen prüfen, Antwort und Speicherung kontrollieren und den Verlauf nach Neuladen wiederherstellen.
   - Smartphone (ab 320 px), iPad Hoch-/Querformat, Fokus, Ladezustand, Realtime-Abgleich, Typprüfung, Tests und Build verifizieren.

## Voraussichtlich betroffene Bereiche
- Neue Datenbankmigration für den privaten Gesprächsverlauf
- Neue Serverfunktion für Turnierfragen; bestehende gemeinsame Gateway-Helfer werden wiederverwendet
- Neuer Service und neue Frage-/Verlaufskomponente
- Ergebnisansicht (`MatchScoring`) und Turnierdaten-Hook für Einbindung und Realtime
- Generierte Datenbanktypen sowie gezielte Tests

## Technische Leitplanken
- Das Gespräch ist privat und je Turnier eindeutig; die öffentliche Live-Zusammenfassung bleibt davon getrennt.
- AI-Schlüssel, Systemanweisung und vollständige Datenaufbereitung bleiben ausschließlich serverseitig.
- Der Browser sendet nur Turnier-ID und aktuelle Frage; die Serverfunktion prüft jede Anfrage erneut.
- Kein Modellwechsel, keine Änderungen an Auslosungs-, Ergebnis- oder Turnierlogik.
