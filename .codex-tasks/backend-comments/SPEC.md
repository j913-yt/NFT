# 后端中文注释

目标：为后端源码补充中文注释，让用户阅读时能理解每个文件、方法和关键变量的作用。

范围：
- `backend/cmd/server/main.go`
- `backend/internal/**/*.go`
- `backend/scripts/reset_contract_data.sql`

不修改：
- 数据库文件、上传图片、环境变量文件、依赖锁文件。

验收：
- 文件顶部说明该文件职责。
- 后端方法和关键变量有中文注释。
- Go 文件经过 `gofmt`。
- 能通过可行的静态或测试验证。
