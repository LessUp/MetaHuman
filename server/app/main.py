import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router

app = FastAPI(title="Digital Human Service")

origins_env = os.getenv("CORS_ALLOW_ORIGINS", "")
if origins_env:
  allowed_origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]
else:
  allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]

app.add_middleware(
  CORSMiddleware,
  allow_origins=allowed_origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
  """健康检查接口，用于确认后端服务是否正常运行。"""
  return {"status": "ok"}


app.include_router(chat_router, prefix="/v1")
