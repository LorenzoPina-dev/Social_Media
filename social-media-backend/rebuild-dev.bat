@echo off
REM =============================================================================
REM rebuild-dev.bat — Ricostruisce tutti i microservizi con le ultime modifiche
REM
REM UTILIZZO:
REM   rebuild-dev.bat           -> rebuild tutti i servizi
REM   rebuild-dev.bat auth      -> rebuild solo auth-service
REM =============================================================================

echo.
echo ==========================================
echo  REBUILD MICROSERVIZI - Social Media Dev
echo ==========================================
echo.

REM Se viene passato un argomento, rebuilda solo quel servizio
IF "%1"=="" GOTO rebuild_all
GOTO rebuild_one

:rebuild_all
echo [*] Rebuild di TUTTI i servizi applicativi...
echo.
docker-compose -f docker-compose.dev.yml up -d --build --no-deps ^
  auth-service ^
  user-service ^
  post-service ^
  media-service ^
  interaction-service ^
  feed-service ^
  notification-service ^
  search-service ^
  moderation-service ^
  nginx
GOTO verify

:rebuild_one
echo [*] Rebuild di: %1-service (o %1 se nome completo)
echo.
docker-compose -f docker-compose.dev.yml up -d --build --no-deps %1
GOTO verify

:verify
echo.
echo [*] Attendo 8 secondi per l'avvio dei servizi...
timeout /t 8 /nobreak > nul

echo.
echo [*] Verifica preflight CORS su auth-service...
curl -s -o nul -w "   HTTP Status preflight: %%{http_code}\n" ^
  -X OPTIONS ^
  -H "Origin: http://localhost:5173" ^
  -H "Access-Control-Request-Method: POST" ^
  -H "Access-Control-Request-Headers: Content-Type,Authorization" ^
  http://localhost/api/v1/auth/login

echo.
echo [*] Header CORS nella risposta preflight:
curl -si ^
  -X OPTIONS ^
  -H "Origin: http://localhost:5173" ^
  -H "Access-Control-Request-Method: POST" ^
  -H "Access-Control-Request-Headers: Content-Type,Authorization" ^
  http://localhost/api/v1/auth/login ^
  | findstr /i "access-control"

echo.
echo ==========================================
echo  Rebuild completato.
echo  Se il preflight ritorna 204 e vedi gli
echo  header CORS, tutto funziona correttamente.
echo ==========================================
echo.
pause
