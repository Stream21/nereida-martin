# Producción — Nereida Martín Studio

Checklist para desplegar en Render con sync de Google Calendar en vivo.

## Build en Render

El `buildCommand` del blueprint usa `NPM_CONFIG_PRODUCTION=false npm ci` en el frontend
para instalar `vite` / `@vitejs/plugin-react` (están en `devDependencies`). Sin eso,
con `NODE_ENV=production` el build falla con `Cannot find package '@vitejs/plugin-react'`.

## Entregabilidad de email (spam)

Los correos salen por Gmail SMTP (`GMAIL_USER`). Para reducir spam: configura SPF/DKIM/DMARC
en el dominio del remitente, mantén el From estable (`Nereida Martín Studio`) y evita
asuntos demasiado "promocionales". La bandeja de entrada vs spam depende del proveedor del destinatario.


## Variables de entorno obligatorias

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL (Render `nere-db`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | OAuth de la cuenta del calendario. El backend también guarda el refresh token en `studio_settings` y lo actualiza si Google lo rota (los redeploys de Render ya no lo pierden). Sigue siendo necesario que la app OAuth esté **En producción** y que el token se emita *después* de publicar. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | (Recomendado) JSON de cuenta de servicio. No caduca ni requiere reautorizar. Ver sección siguiente. |
| `GOOGLE_CALENDAR_ID` | ID del calendario (ej. `nere.browroom@gmail.com`) |
| `BACKEND_URL` / `FRONTEND_URL` | URL pública HTTPS del servicio |
| `BOOKING_START_DATE` | Primer día que acepta reservas web (`YYYY-MM-DD`) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | SMTP para emails de confirmación/cancelación |
| `CRON_SECRET` | Protege endpoints `/api/cron/*` |
| `OWNER_DASHBOARD_EMAIL` | Email de acceso al panel `/studio` |
| `OWNER_DASHBOARD_PASSWORD_HASH` | Hash bcrypt de la contraseña del panel |
| `JWT_SECRET` | Firma de sesión del panel (string aleatorio largo) |

## Google Calendar — que el token no vuelva a caducar

Publicar la app OAuth **no alarga** un refresh token ya emitido en modo Prueba. Si el cron vuelve a fallar ~7–10 días después, Google sigue emitiendo tokens de prueba o ha rotado el token y Render seguía con el valor viejo de Environment.

El backend ahora:

1. Guarda el refresh token en `studio_settings` (sobrevive a redeploys).
2. Si Google rota el token, persiste el nuevo.
3. Al autorizar (`npm run google:auth`) muestra la vida real del token. Si dice **7 días**, la pantalla de consentimiento sigue en **Prueba**.

### Opción estable: cuenta de servicio (recomendado)

No hay consentimiento, ni refresh token, ni caducidad a 7 días.

1. Google Cloud → **IAM y administración** → **Cuentas de servicio** → crear (p. ej. `nere-calendar`).
2. Crear clave JSON y copiar el contenido **en una sola línea** a `GOOGLE_SERVICE_ACCOUNT_JSON` en **nere-studio**.
3. En Google Calendar de `nere.browroom@gmail.com` → Ajustes del calendario → **Compartir con determinadas personas** → añadir el email de la cuenta de servicio (`…@….iam.gserviceaccount.com`) con permiso **Hacer cambios en los eventos**.
4. `GOOGLE_CALENDAR_ID=nere.browroom@gmail.com`

Con esa variable presente, el OAuth de usuario se ignora.

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
   GOOGLE_WEBHOOK_URL=https://www.nerebrowroom.es/api/webhooks/google-calendar
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

Definidos en `render.yaml`:

| Job | Schedule | Comando |
|-----|----------|---------|
| `nere-reminders` | `*/30 * * * *` | `node scripts/trigger-reminders.js` |
| `nere-calendar-sync` | `*/15 * * * *` | `node scripts/trigger-calendar-sync.js` |

El cron de calendar-sync cubre:
- Sync incremental si el webhook falló
- Renovación del canal watch
- Reconciliación de eventos web ↔ Google (cancelaciones, huérfanos, faltantes)

## Migración inicial de citas

Una sola vez (o cuando quieras reimportar el año). En Render:

**One-off Job** (Dashboard → nere-studio → Manual Deploy / Jobs → One-off Job)  
o **Shell** del web service:

```bash
cd backend && node scripts/sync-calendar-init.js --year=2026
```

Dry-run primero (recomendado):

```bash
cd backend && node scripts/sync-calendar-init.js --year=2026 --dry-run
```

Local contra prod (con `.env` apuntando a `DATABASE_URL` de Render):

```bash
cd backend
npm run calendar:init:year
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
