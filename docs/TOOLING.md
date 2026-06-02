# Инструменты (бесплатные)

| Задача | Инструмент | Команда |
|--------|------------|---------|
| Unit-тесты TS | Vitest | `bun run test:unit` |
| E2E UI | Playwright | `bun run test:e2e` (нужны :3000 и :3031) |
| Python smoke | pytest | `bun run test:python` |
| Windows verify | verify-windows.ps1 | `bun run verify:win` |
| CI | GitHub Actions | `.github/workflows/ci.yml` |
| Диаграммы | Mermaid | `docs/ARCHITECTURE.md` |
| Типы из Python | quicktype / ручной sync | `src/types/excel-service-schemas.ts` |

## Опционально (не в runtime)

- **TypeDoc** — `npx typedoc src/lib --out docs/api` (документация TS)
- **Snyk** — `npx snyk test` (скан npm/pip)
- **OWASP ZAP** — ручной DAST против http://127.0.0.1:3000
- **Winston / Pino** — только если добавите отдельный Node-сервис; excel-service логирует в uvicorn + `logs/excel-service.log`

## Регенерация типов (quicktype)

```bash
# Пример: из JSON Schema (экспорт из Pydantic вручную)
npx quicktype --lang ts --src-lang schema schema.json -o src/types/generated.ts
```

Сейчас типы синхронизированы вручную с `mini-services/excel-service/schemas.py`.
