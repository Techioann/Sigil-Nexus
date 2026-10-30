# Sigil Nexus

Przeglądarkowa gra akcji o rysowaniu znaków i łączeniu żywiołów.

## Uruchomienie

Wymagany jest Node.js. Otwórz folder projektu w VS Code i w terminalu uruchom:

```sh
npm install
npm run dev
```

Otwórz `http://localhost:3000`. Port można zmienić zmienną środowiskową `PORT`. W PowerShellu, jeśli polityka wykonywania blokuje `npm.ps1`, użyj `npm.cmd install` i `npm.cmd run dev`.

Jeśli starsza wersja serwera jest już uruchomiona, zatrzymaj ją w terminalu przez `Ctrl+C` i uruchom ponownie, aby wczytać obsługę multiplayer.

Testy uruchomisz poleceniem `npm test` (lub `npm.cmd test` w PowerShellu).

## Pokoje i wspólna gra

W menu wybierz jedną z czterech postaci, zapoznaj się z jej statystykami i wpisz imię o długości 3–16 znaków. Żadna postać nie jest wybrana domyślnie. **Graj online** dołącza do publicznej gry, **Utwórz prywatny pokój** tworzy osobną arenę, a **Dołącz** pozwala wejść sześcioliterowym lub cyfrowym kodem otrzymanym od znajomego. Przyciski są dostępne po poprawnym uzupełnieniu wymaganych danych. Wybór postaci pozostaje zachowany przy powrocie do menu pokoju. Pokoje są odizolowane i mieszczą do 20 graczy. Po utworzeniu pokoju skopiuj jego kod przyciskiem nad areną i przekaż go innym. Jeśli przeglądarka nie udostępnia schowka, zaznacz i skopiuj kod ręcznie. Kod pozwala dołączyć do pokoju; nie jest hasłem ani mechanizmem uwierzytelniania.

Interfejs pokazuje stan łączenia, połączenie, rozłączenie i błędy. Gdy połączenie zostanie przerwane lub pokój jest niedostępny, sprawdź komunikat i użyj przycisku ponowienia albo popraw kod i spróbuj jeszcze raz. Kod może być nieprawidłowy, pokój może już nie istnieć lub być pełny, a serwer może być niedostępny. W razie restartu serwera bieżące pokoje i połączenia mogą zniknąć.

### Lokalnie i w sieci LAN

1. Uruchom serwer na jednym komputerze poleceniem `npm run dev`.
2. Na tym samym komputerze otwórz `http://localhost:3000` w dwóch kartach, aby sprawdzić połączenie dwóch graczy. Jeśli ustawiono inny port, użyj go w obu kartach.
3. W sieci lokalnej sprawdź adres IP komputera z serwerem (na Windows: `ipconfig`). Na każdym urządzeniu w tej samej sieci otwórz `http://ADRES-IP-SERWERA:3000`, zastępując adres i ewentualnie port właściwymi wartościami. `localhost` na drugim urządzeniu wskazuje na nie samo, a nie na komputer z serwerem.
4. Jeśli strona lub połączenie nie działa, sprawdź adres i port, dostępność urządzeń w sieci oraz ustawienia zapory na komputerze serwera. W razie potrzeby zezwól na połączenia przychodzące dla używanego portu w zaufanej sieci.

### Wdrożenie przez internet

`localhost` i prywatny adres LAN nie są publicznymi adresami serwera. Samo uruchomienie `npm run dev` nie udostępnia gry w internecie. Potrzebny jest publicznie osiągalny host, odpowiednia konfiguracja DNS, sieci i zapory oraz proces serwera działający na tym hoście. Jeśli używasz routera, dostęp może wymagać przekierowania portu; publiczny adres nie zawsze jest dostępny, np. za CGNAT.

W produkcji udostępniaj stronę przez HTTPS i skonfiguruj serwer lub reverse proxy z certyfikatem TLS oraz obsługą przekazywania połączeń WebSocket (HTTP Upgrade). Strona HTTPS wymaga `wss://`; przeglądarka zablokuje niezabezpieczone `ws://` jako mixed content. Zadbaj o zgodny adres i port połączenia, przekazywanie WebSocket i limity/czas bezczynności proxy. Nie zakładaj, że lokalny serwer deweloperski jest gotowy do bezpiecznego publicznego wdrożenia: przed wystawieniem oceń ochronę przed nadużyciami, limity zasobów i ryzyko dostępu osób trzecich.

## Sterowanie

- `W`, `A`, `S`, `D` lub strzałki: ruch.
- Przytrzymaj lewy przycisk myszy i narysuj znak na arenie: kroplę wody, zygzak ognia, romb ziemi albo spiralę wiatru.
- Kliknij innego gracza, aby wystrzelić przygotowane zaklęcie. Na arenie nie ma botów treningowych.
- Drugi znak narysowany w ciągu sekundy łączy dwa żywioły w fuzję. Każdy przyjęty znak zużywa punkt many, która odnawia się z czasem.

Każdy znak rysuj jedną ciągłą linią. Kropla i romb są zamknięte; możesz zacząć w dowolnym miejscu ich obrysu i rysować w dowolnym kierunku. Ogień to otwarty zygzak z czterech odcinków. Spiralę wiatru można kreślić od środka lub od zewnątrz, w obu kierunkach. Wzory znajdują się w księdze znaków obok areny.

Interfejs pokazuje życie, manę, regenerację, przygotowane zaklęcie, czas na fuzję i wynik rozpoznawania ostatniego znaku.

## Żywioły i przeciwnicy

Cykl przewag to **woda → ogień → ziemia → wiatr → woda**. Żywioł atakujący następny w cyklu zadaje 1,5× obrażeń; atak w przeciwnym kierunku trafia w odporność i zadaje 0,75×. Pozostałe zestawienia są neutralne (1×), podobnie jak trafienia graczy, którzy nie mają jeszcze żywiołu. Żywioł gracza to ostatni poprawnie rozpoznany podstawowy znak. Pojedyncze zaklęcie ma 10 obrażeń bazowych, a fuzja 20. Mnożnik fuzji jest średnią mnożników obu jej żywiołów. Interfejs pokazuje mnożnik i skuteczność ostatniego własnego trafienia.

Domyślne mnożniki i kolejność cyklu znajdują się w `src/ElementalCombatSystem.js`. Przy tworzeniu świata można je również przekazać przez `new World({ combatOptions: { advantage: 1.5, neutral: 1, resistance: 0.75, cycle: ['water', 'fire', 'earth', 'wind'] } })`.
