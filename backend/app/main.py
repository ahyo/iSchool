from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import actions, auth, crud

app = FastAPI(
    title="iSchool API",
    description="Backend Sistem Informasi Sekolah terpadu (SD, SMP, SMA, SMK): PPDB, keuangan, presensi, akademik, kepegawaian.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok"}


# Urutan penting: router spesifik sebelum router generik /api/{resource}
app.include_router(auth.router)
app.include_router(actions.router)
app.include_router(crud.router)
