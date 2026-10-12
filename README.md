# Turnero de ventanilla

Aplicación Angular + FastAPI para una recepción y cuatro mesas de atención. Incluye registro de clientes, fila FIFO, llamada del siguiente turno, rellamada y cierre de atención. La pantalla se actualiza cada 3 segundos. Los folios se generan con el ID único de la base de datos para mantener el orden de asignación. La interfaz conserva la identidad de cada fila durante las actualizaciones periódicas.

## Desarrollo local

Requisitos: Node.js 20.19+ y Python 3.10+.

1. Backend (SQLite local):

   ```powershell
   cd backend
   py -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app:app --reload
   ```

2. En otra terminal, ejecuta la interfaz:

   ```powershell
   npm install
   npm start
   ```

   Abre `http://localhost:4200`. El proxy local conecta `/api` con FastAPI en el puerto 8000.

## Despliegue en Vercel conectado a GitHub

1. Sube la carpeta `turnero` a un repositorio de GitHub.
2. En Vercel elige **Add New Project**, importa ese repositorio y deja el **Root Directory** en `./` (raíz del repositorio).
3. Vercel detecta los servicios `app` (Angular) y `backend` (FastAPI) desde `vercel.json` y los publica bajo el mismo dominio; las rutas `/api/*` se envían al backend.
4. Crea una base PostgreSQL administrada (por ejemplo, Neon o Supabase) y agrega `DATABASE_URL` en **Settings → Environment Variables** para Production y Preview. Usa una URL compatible con psycopg 3, como `postgresql+psycopg://...`.
5. Despliega. Los siguientes `push` a GitHub generan nuevos deployments automáticamente.

Vercel ejecuta funciones sin almacenamiento local persistente; por eso en Vercel debe configurarse PostgreSQL. Si `DATABASE_URL` no existe, el backend usa SQLite para desarrollo local. En la pantalla de importación selecciona **Import multi-service project** después de pulsar **Refresh**.

## API

- `GET /api/health`
- `POST /api/turnos` — `{ "nombre": "Ana", "tramite": "Actualización de datos" }`
- `GET /api/turnos`
- `GET /api/mesas`
- `POST /api/mesas/{1..4}/siguiente`
- `POST /api/turnos/{id}/rellamar`
- `POST /api/turnos/{id}/finalizar`

La interfaz actual es una primera versión operativa de mostrador. No incluye inicio de sesión ni roles de usuario.
