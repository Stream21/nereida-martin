# Arranca el entorno local completo: BD (Docker en WSL) → init → build → backend
# Uso: .\scripts\start-dev.ps1
#      .\scripts\start-dev.ps1 -Tunnel

param(
    [switch]$Tunnel
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$WslRoot = (wsl wslpath -a $Root).Trim()

function Test-PortOpen($Port) {
    $r = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
    return $r.TcpTestSucceeded
}

function Invoke-WslDocker($ComposeArgs) {
    $cmd = "cd '$WslRoot' && docker-compose $ComposeArgs"
    wsl -e bash -lc $cmd
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose $ComposeArgs falló (código $LASTEXITCODE)"
    }
}

function Start-DockerDb {
    if (-not (wsl which docker 2>$null)) {
        return $false
    }
    Write-Host ">> Docker (WSL): arrancando PostgreSQL en puerto 5433..." -ForegroundColor Cyan
    Invoke-WslDocker "up -d"

    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortOpen 5433) { return $true }
        Start-Sleep -Seconds 2
    }
    throw "PostgreSQL en Docker (WSL) no respondió en el puerto 5433."
}

Write-Host "`n=== Studio Anuelblingding — entorno local ===`n" -ForegroundColor Magenta

if (-not (Test-PortOpen 5433)) {
    if (-not (Start-DockerDb)) {
        throw @"
Docker no está disponible en WSL.

Abre WSL y comprueba: docker ps
Si hace falta: sudo service docker start
"@
    }
} else {
    Write-Host ">> PostgreSQL ya activo en puerto 5433 (Docker WSL)." -ForegroundColor Green
}

Push-Location $Backend

Write-Host ">> Inicializando tablas y datos..." -ForegroundColor Cyan
npm run db:init

Write-Host ">> Compilando frontend..." -ForegroundColor Cyan
Push-Location $Frontend
npm run build
Pop-Location

Write-Host ">> Arrancando backend en http://localhost:3001 ..." -ForegroundColor Cyan
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:Backend
    npm start 2>&1
}

Start-Sleep -Seconds 3
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 10
    Write-Host ">> Backend OK: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host ">> Backend arrancando... revisa logs si no responde." -ForegroundColor Yellow
}

if ($Tunnel) {
    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
        Write-Host ">> cloudflared no instalado — sin túnel público." -ForegroundColor Yellow
    } else {
        Write-Host ">> Abriendo túnel público (cloudflared)..." -ForegroundColor Cyan
        Start-Process cloudflared -ArgumentList "tunnel","--url","http://localhost:3001" -NoNewWindow
        Write-Host "   Busca la URL https://....trycloudflare.com en la salida de cloudflared." -ForegroundColor Green
    }
}

Pop-Location

Write-Host @"

Listo.
  Web local:    http://localhost:3001
  Reservar:     http://localhost:3001/reservar
  BD:           PostgreSQL en Docker WSL (puerto 5433, volumen nere_pg_data)
  Sync:         cd backend && npm run calendar:sync

"@ -ForegroundColor Green

Write-Host "Backend en segundo plano (Job Id: $($backendJob.Id))." -ForegroundColor DarkGray
Write-Host "Logs: Receive-Job -Id $($backendJob.Id) -Keep" -ForegroundColor DarkGray
