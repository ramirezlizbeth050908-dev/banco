from contextlib import asynccontextmanager
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from threading import Lock
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlmodel import Field as SQLField, Session, SQLModel, create_engine, select


if os.getenv("VERCEL"):
    # Vercel functions have a read-only deployment filesystem; /tmp is writable.
    DB_PATH = Path("/tmp/turnos.db")
else:
    DB_PATH = Path(__file__).parent / "turnos.db"
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{DB_PATH}"
engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
engine = create_engine(DATABASE_URL, **engine_options)
db_lock = Lock()


class Estado(str, Enum):
    ESPERA = "espera"
    ATENDIENDO = "atendiendo"
    FINALIZADO = "finalizado"


class Turno(SQLModel, table=True):
    id: int | None = SQLField(default=None, primary_key=True)
    folio: str = SQLField(index=True)
    nombre: str = "Cliente"
    tramite: str = "Atención general"
    estado: Estado = Estado.ESPERA
    mesa: int | None = None
    creado: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))
    llamado: datetime | None = None
    terminado: datetime | None = None


class NuevoTurno(BaseModel):
    nombre: str = Field(default="Cliente", min_length=1, max_length=80)
    tramite: str = Field(default="Atención general", min_length=1, max_length=80)


@asynccontextmanager
async def lifespan(_: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield


app = FastAPI(title="Turnero de ventanilla", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_methods=["*"], allow_headers=["*"],
)


def ahora():
    return datetime.now(timezone.utc)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/turnos", response_model=Turno, status_code=201)
def crear_turno(payload: NuevoTurno):
    with db_lock, Session(engine) as session:
        count = len(session.exec(select(Turno)).all())
        turno = Turno(folio=f"A{count + 1:03d}", nombre=payload.nombre.strip(), tramite=payload.tramite.strip())
        session.add(turno)
        session.commit()
        session.refresh(turno)
        return turno


@app.get("/api/turnos", response_model=list[Turno])
def listar_turnos():
    with Session(engine) as session:
        return session.exec(select(Turno).order_by(Turno.id.desc()).limit(100)).all()


@app.get("/api/mesas")
def estado_mesas():
    with Session(engine) as session:
        activos = session.exec(select(Turno).where(Turno.estado == Estado.ATENDIENDO)).all()
        por_mesa = {t.mesa: t for t in activos}
        return [{"mesa": i, "turno": por_mesa.get(i)} for i in range(1, 5)]


@app.post("/api/mesas/{mesa}/siguiente", response_model=Turno)
def siguiente(mesa: int):
    validar_mesa(mesa)
    with db_lock, Session(engine) as session:
        ocupado = session.exec(select(Turno).where(Turno.mesa == mesa, Turno.estado == Estado.ATENDIENDO)).first()
        if ocupado:
            raise HTTPException(409, f"La mesa {mesa} ya tiene un turno en atención")
        turno = session.exec(select(Turno).where(Turno.estado == Estado.ESPERA).order_by(Turno.id)).first()
        if not turno:
            raise HTTPException(404, "No hay turnos en espera")
        turno.estado, turno.mesa, turno.llamado = Estado.ATENDIENDO, mesa, ahora()
        session.add(turno)
        session.commit()
        session.refresh(turno)
        return turno


def validar_mesa(mesa: int):
    if mesa not in range(1, 5):
        raise HTTPException(400, "La mesa debe estar entre 1 y 4")


def obtener_turno(session: Session, turno_id: int) -> Turno:
    turno = session.get(Turno, turno_id)
    if not turno:
        raise HTTPException(404, "Turno no encontrado")
    return turno


@app.post("/api/turnos/{turno_id}/finalizar", response_model=Turno)
def finalizar(turno_id: int):
    with db_lock, Session(engine) as session:
        turno = obtener_turno(session, turno_id)
        if turno.estado != Estado.ATENDIENDO:
            raise HTTPException(409, "El turno no está en atención")
        turno.estado, turno.terminado = Estado.FINALIZADO, ahora()
        session.add(turno)
        session.commit()
        session.refresh(turno)
        return turno


@app.post("/api/turnos/{turno_id}/rellamar", response_model=Turno)
def relamar(turno_id: int):
    with db_lock, Session(engine) as session:
        turno = obtener_turno(session, turno_id)
        if turno.estado != Estado.ATENDIENDO:
            raise HTTPException(409, "El turno no está en atención")
        turno.llamado = ahora()
        session.add(turno)
        session.commit()
        session.refresh(turno)
        return turno
