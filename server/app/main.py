import os
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router

# 记录服务启动时间
START_TIME = time.time()

app = FastAPI(
    title="Digital Human Service",
    description="MetaHuman 数字人后端服务",
    version="1.0.0"
)

# CORS 配置 - 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        # 生产环境域名可在此添加
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    """健康检查接口，用于确认后端服务是否正常运行。"""
    uptime = time.time() - START_TIME
    has_openai_key = bool(os.getenv("OPENAI_API_KEY"))
    
    return {
        "status": "ok",
        "uptime_seconds": round(uptime, 2),
        "version": "1.0.0",
        "services": {
            "chat": "available",
            "llm": "available" if has_openai_key else "mock_mode",
        }
    }


@app.get("/")
async def root() -> dict:
    """根路径，返回服务基本信息。"""
    return {
        "service": "MetaHuman Digital Human Service",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


app.include_router(chat_router, prefix="/v1")
