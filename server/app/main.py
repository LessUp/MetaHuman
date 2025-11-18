from fastapi import FastAPI
from app.api.chat import router as chat_router

app = FastAPI(title="Digital Human Service")


@app.get("/health")
async def health() -> dict:
  """健康检查接口，用于确认后端服务是否正常运行。"""
  return {"status": "ok"}


app.include_router(chat_router, prefix="/v1")
