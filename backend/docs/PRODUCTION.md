# Producción — Studio Anuelblingding

Checklist para desplegar en Render con sync de Google Calendar en vivo.

## Build en Render

El `buildCommand` del blueprint usa `NPM_CONFIG_PRODUCTION=false npm ci` en el frontend
para instalar `vite` / `@vitejs/plugin-react` (están en `devDependencies`). Sin eso,
con `NODE_ENV=production` el build falla con `Cannot find package '@vitejs/plugin-react'`.


## Variables de entorno obligatorias

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL (Render `nere-db`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | OAuth cuenta corporativa Nereida |
| `GOOGLE_CALENDAR_ID` | ID del calendario (ej. `nere.browroom@gmail.com`) |
| `BACKEND_URL` / `FRONTEND_URL` | URL pública HTTPS del servicio |
| `BOOKING_START_DATE` | Primer día que acepta reservas web (`YYYY-MM-DD`) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | SMTP para emails de confirmación/cancelación |
| `CRON_SECRET` | Protege endpoints `/api/cron/*` |
| `OWNER_DASHBOARD_EMAIL` | Email de acceso al panel `/studio` |
| `OWNER_DASHBOARD_PASSWORD_HASH` | Hash bcrypt de la contraseña del panel |
| `JWT_SECRET` | Firma de sesión del panel (string aleatorio largo) |

## Panel privado `/studio`

Acceso exclusivo para Nereida: clientes, servicios, métricas y exportación Excel.

### Configurar credenciales (una sola vez)

```bash
cd backend
node scripts/hash-owner-password.js "contraseña-segura"
```

Copiar en `.env` / Render:

```env
OWNER_DASHBOARD_EMAIL=nere.browroom@gmail.com
OWNER_DASHBOARD_PASSWORD_HASH=<hash generado>
JWT_SECRET=<openssl rand -hex 32 o similar>
```

### Uso

- URL: `https://TU-DOMINIO/studio`
- Sin registro público; solo el usuario definido en `OWNER_DASHBOARD_EMAIL`
- Sesión JWT válida 7 días (`sessionStorage` en el navegador)
- Exportación Excel: pestaña **Servicios** → filtrar mes/año → **Exportar Excel**

### Migración BD

```bash
cd backend
npm run db:init
```

Aplica `migration_owner_dashboard.sql` (tabla `metric_goals`).


Cuando Nereida crea/edita una cita en Google, el backend debe recibir notificaciones push.

1. Desplegar backend con URL HTTPS pública (Render).
2. Configurar en Render:
   ```
   GOOGLE_WEBHOOK_URL=https://TU-DOMINIO.onrender.com/api/webhooks/google-calendar
   GOOGLE_WEBHOOK_SECRET=<valor aleatorio>
   ```
3. Al arrancar, el servidor registra `events.watch` automáticamente ([`calendarSync.ensureWatchChannel`](services/calendarSync.js)).
4. El canal expira ~7 días; se renueva al arrancar y vía cron.

### Flujo webhook

```
Google Calendar → POST /api/webhooks/google-calendar
                → syncIncremental()
                → [Bloqueo] ignorado
                → Cita solapada → fantasma (no insert)
                → Cita nueva libre → insert en bookings
                → [Web] → enlaza booking existente
```

## Cron jobs (Render)

| Job | Schedule | Comando |
|-----|----------|---------|
| `nere-reminders` | `*/30 * * * *` | `node scripts/trigger-reminders.js` |
| Calendar reconcile | Recomendado cada 15-30 min | `POST /api/cron/calendar-sync` con header `Authorization: Bearer $CRON_SECRET` |

El cron de calendar-sync cubre:
- Sync incremental si el webhook falló
- Renovación del canal watch
- Reconciliación de eventos web ↔ Google

## Migración inicial de citas

Antes del go-live, en el servidor o local contra BD de producción:

```bash
cd backend
npm run calendar:init -- --from=2026-01-01 --to=2026-12-31
```

## Convenciones Google Calendar (Nereida)

| Prefijo | Uso |
|---------|-----|
| `[Bloqueo] Vacaciones` | Cierra días en la web (no se importa a BD) |
| `[Web] Tratamiento – Cliente` | Reserva desde la web (automático) |
| Sin prefijo | Cita real → webhook la importa si el hueco está libre |

## Verificación post-deploy

- [ ] `GET /api/health` responde OK
- [ ] `GET /api/availability/next?treatmentId=brow-define` devuelve fecha/hora
- [ ] Reserva web crea evento `[Web]` en Google Calendar
- [ ] Email de confirmación incluye enlace `/cancelar/:token`
- [ ] `[Bloqueo]` en Google cierra huecos en `/api/availability`
- [ ] Nueva cita manual en Google aparece en BD tras webhook (sin solape)
- [ ] Cita solapada en Google NO aparece en BD (fantasma)
