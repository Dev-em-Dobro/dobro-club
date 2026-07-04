# Phase 1 — Data Model: Streak e badges

**Sem tabela nova, sem coluna nova.** Streak/badges **derivados** de `engagement_events` + lead score.

## Entidades

### `engagement_events` (REÚSO — fonte)

- Já existe (id, event_id, lead_id, type, data, created_at). O streak usa `created_at` dos eventos
  `content.opened`/`live.opened`; os badges usam contagens por tipo. Sem alteração.

### Lead score (REÚSO — `lib/score.ts`, 8.18)

- `getLeadScore(eventId, leadId).score` alimenta a badge `engajado`.

### Tipos derivados (em TypeScript — `lib/gamification.ts`)

```
DAY_TZ_OFFSET_MIN = -180                 // São Paulo (UTC-3, sem DST)
ACTIVE_TYPES = ['content.opened', 'live.opened']

type Streak = { current: number; longest: number };
type BadgeDef = { id: string; name: string; description: string; criterion: string;
                  test: (ctx: BadgeCtx) => boolean };
type BadgeCtx = { counts: Record<string, number>; streak: Streak; score: number };
type Badge = { id: string; name: string; description: string; criterion: string; earned: boolean };
type LeadGamification = { streak: Streak; badges: Badge[] };
```

## Regras derivadas (puras)

```
dayKey(iso, offsetMin = DAY_TZ_OFFSET_MIN):
    d = new Date(new Date(iso).getTime() + offsetMin*60_000)
    return d.toISOString().slice(0, 10)          // 'YYYY-MM-DD' no fuso

computeStreak(dayKeys: string[], today: Date):
    set = unique(dayKeys)                          // mesmo-dia colapsa
    longest = maior run de dias de calendário consecutivos em `set`
    tHoje = dayKey(today), tOntem = dayKey(today - 1 dia)
    // âncora com tolerância (D3): começa em hoje, ou em ontem se hoje ainda vazio
    anchor = set.has(tHoje) ? tHoje : set.has(tOntem) ? tOntem : null
    current = anchor ? (conta dias consecutivos retrocedendo a partir de anchor) : 0
    return { current, longest }

BADGES: BadgeDef[]   // catálogo fixo (research D4)

evaluateBadges(ctx) = BADGES.map(b => ({ id,name,description,criterion,
                                         earned: safe(() => b.test(ctx)) }))   // erro ⇒ false
```

## Função de leitura (em `lib/gamification.ts`)

```
getLeadGamification(eventId, leadId, now = new Date()) -> LeadGamification
    rows = query(SELECT type, created_at FROM engagement_events WHERE event_id=$1 AND lead_id=$2)
    counts = contagem por type
    dayKeys = rows.filter(type ∈ ACTIVE_TYPES).map(r => dayKey(r.created_at))
    streak = computeStreak(dayKeys, now)
    score = (await getLeadScore(eventId, leadId)).score
    badges = evaluateBadges({ counts, streak, score })
    return { streak, badges }
```

## Validação / invariantes

- **Determinismo** (FR-006/SC-005): mesmos eventos ⇒ mesmo streak e badges.
- **Mesmo-dia = 1** (FR-003/SC-003): `dayKeys` deduplicado por Set.
- **Quebra** (FR-003/SC-002): gap de ≥1 dia zera o `current` (respeitando tolerância D3).
- **Degradação segura** (FR-010/SC-006): lead sem eventos ⇒ `{current:0,longest:0}`, badges todos
  `earned:false`; badge com `test` que erra ⇒ `earned:false` (não derruba os demais).
- **Badges de streak usam `longest`**: conquista não se perde ao quebrar o streak.
