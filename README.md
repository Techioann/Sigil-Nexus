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

### Render.com: Web Service

Poniżej znajduje się konfiguracja planowanego wdrożenia istniejącego repozytorium `Techioann/Sigil-Nexus` z gałęzi `main`. Nie oznacza ona, że aplikacja została wdrożona.

Przed wdrożeniem zatwierdź i wyślij zmiany z obsługą `npm start` i `/healthz` do gałęzi `main`, którą Render ma budować.

1. W panelu Render zaloguj się, wybierz utworzenie **Web Service** i połącz istniejące repozytorium GitHub `Techioann/Sigil-Nexus`. Jeśli nie jest widoczne, przyznaj integracji Render dostęp do tego repozytorium. Nie twórz nowego repozytorium.
2. Wybierz gałąź `main` i ustaw runtime **Node**. Pole **Root Directory** pozostaw puste, aby użyć katalogu głównego repozytorium.
3. Ustaw **Build Command** na `npm ci`, a **Start Command** na `npm start`. Repozytorium zawiera `package-lock.json`; `npm ci` instaluje zależności zgodnie z lockfile. Nie jest wymagany osobny etap budowania frontendu.
4. Wybierz plan instancji **Free**, ustaw **Health Check Path** na `/healthz` i **Auto-Deploy** na **On Commit**. Sprawdź aktualne warunki i limity planu Free w Render, ponieważ mogą się zmieniać.
5. Utwórz usługę i obserwuj logi budowania oraz uruchamiania. Render udostępni adres usługi `https://...onrender.com`; użyj adresu pokazanego w panelu, a nie `localhost`. Render dostarcza `PORT`, który serwer odczytuje; nie ustawiaj go na stałe na `3000`.
6. Sprawdź w panelu stan wdrożenia i health check, a pod adresem `https://ADRES-USLUGI/healthz` odpowiedź HTTP 200. Otwórz stronę przez HTTPS, a następnie w dwóch kartach lub na dwóch urządzeniach utwórz prywatny pokój i dołącz do niego kodem. Potwierdź, że obaj gracze widzą swoje ruchy. W narzędziach deweloperskich przeglądarki można sprawdzić połączenie `wss://ADRES-USLUGI/ws` i jego przejście do stanu otwartego.

Render obsługuje HTTPS na publicznym adresie usługi. Klient wybiera `wss://` dla strony HTTPS i łączy się ze ścieżką `/ws` na tym samym hoście; nie trzeba wpisywać osobnego adresu WebSocket. W razie błędów sprawdź logi Render, odpowiedź health check, konsolę i kartę Network przeglądarki oraz stan połączenia WebSocket. Automatyczne wdrożenie dotyczy kolejnych commitów na wybranej gałęzi, ale jego sukces należy sprawdzić w panelu.

Plan Free może usypiać nieaktywną usługę: pierwsze żądanie po uśpieniu może długo czekać na zimny start. Pokoje i stan gry są przechowywane tylko w pamięci procesu, bez trwałego zapisu ani współdzielenia między instancjami. Restart, nowe wdrożenie lub uśpienie mogą zerwać połączenia i usunąć pokoje oraz ich kody; gracze muszą wtedy utworzyć pokój ponownie. Wiele instancji bez wspólnego magazynu nie zapewni spójnego dostępu do tych samych pokoi. Plan Free i obecne ograniczenia aplikacji nie gwarantują dostępności, trwałości ani ochrony przed nadużyciami.

## Sterowanie

- Pomoc otwiera przycisk **POMOC** lub `H`; `H` i `Escape` zamykają panel. Skróty nie działają podczas wpisywania tekstu. Pomoc nie zatrzymuje gry.
- Po pierwszym wejściu na arenę pojawia się samouczek. **Gotowe** i **Pomiń** zapisują wybór w lokalnej pamięci przeglądarki; pomoc można później otworzyć ponownie. Ćwiczenia znaków działają lokalnie, bez wysyłania danych i bez zużywania many.
- `W`, `A`, `S`, `D` lub strzałki: ruch.
- Przytrzymaj lewy przycisk myszy i narysuj znak na arenie: kroplę wody, zygzak ognia, romb ziemi albo spiralę wiatru.
- Kliknij prawym przyciskiem myszy na arenie, aby wystrzelić przygotowane zaklęcie w wybranym kierunku. Na arenie nie ma botów treningowych.
- Drugi znak narysowany w ciągu sekundy łączy dwa żywioły w fuzję. Każdy przyjęty znak zużywa punkt many, która odnawia się z czasem.

Każdy znak rysuj jedną ciągłą linią. Kropla i romb są zamknięte; możesz zacząć w dowolnym miejscu ich obrysu i rysować w dowolnym kierunku. Ogień to otwarty zygzak z czterech odcinków. Spiralę wiatru można kreślić od środka lub od zewnątrz, w obu kierunkach. Wzory znajdują się w księdze znaków obok areny.

Interfejs pokazuje życie, manę, regenerację, przygotowane zaklęcie, czas na fuzję i wynik rozpoznawania ostatniego znaku.

## Żywioły i przeciwnicy

Cykl przewag to **woda → ogień → ziemia → wiatr → woda**. Żywioł atakujący następny w cyklu zadaje 1,5× obrażeń; atak w przeciwnym kierunku trafia w odporność i zadaje 0,75×. Pozostałe zestawienia są neutralne (1×). Żywioł obronny gracza wynika z wybranej postaci, niezależnie od narysowanego znaku. Pojedyncze zaklęcie ma 10 obrażeń bazowych, a fuzja 20. Mnożnik fuzji jest średnią mnożników obu jej żywiołów. Interfejs pokazuje mnożnik i skuteczność ostatniego własnego trafienia.

Domyślne mnożniki i kolejność cyklu znajdują się w `src/ElementalCombatSystem.js`. Przy tworzeniu świata można je również przekazać przez `new World({ combatOptions: { advantage: 1.5, neutral: 1, resistance: 0.75, cycle: ['water', 'fire', 'earth', 'wind'] } })`.
