# Pre-commit и проверки зависимостей

После `bun install` активируется Husky (`prepare` → `.husky/pre-commit`).

При каждом коммите:

1. `bun run typecheck`
2. `lint-staged` (ESLint для staged `.ts`/`.tsx`)
3. `bun run test:unit`

Ручной прогон тех же шагов:

```bash
bun run precommit
```

## Аудит npm/bun

```bash
bun run audit       # npm audit + опционально pip-audit
```

Первый раз после клонирования: `bun install` (нужны `husky`, `lint-staged` из devDependencies).

## Тесты

```bash
bun run test:unit          # Vitest (src + tests/unit)
bun run test:python        # pytest excel-service
bun run test               # оба набора
```
