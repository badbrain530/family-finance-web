-- PostgreSQL 初始化脚本
-- 安装 pgvector 扩展（为后续AI对话顾问RAG架构预留）

CREATE EXTENSION IF NOT EXISTS vector;

-- 安装 pg_trgm 扩展（用于交易搜索、商户名模糊匹配）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 安装 pg_stat_statements 扩展（用于慢查询分析）
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
