# BETMAN Growth Agent

The Growth Agent is BETMAN-WORKER's first autonomous commercial capability. Its north-star metric is retained paid customers, not clicks or post engagement.

## Safety model

The first release is permanently dry-run. It reads Meta and Core, writes a local snapshot and append-only audit ledger, and produces deterministic recommendations. It contains no Meta write path.

Hard limits remain outside the language model:

- no total-budget increases;
- no campaign writes in the initial release;
- maximum future budget movement of 20% per 48 hours;
- no scaling without at least 10 attributed trials or 3 attributed paid customers;
- no inferred attribution when campaign identifiers are absent;
- no paid-customer credit until a Stripe purchase is joined to the campaign;
- source failures make the run unhealthy rather than falling back to invented data.

## Runtime

- Host: `BETMAN-WORKER` (`192.168.1.171`)
- User: unprivileged `betman`
- Schedule: every four hours at minute 17, with jitter
- Snapshot: `/opt/betman/betman_hq/runtime/growth-agent/latest.json`
- Audit ledger: `/opt/betman/betman_hq/runtime/growth-agent/audit.jsonl`
- HQ route: `/growth`
- Health route: `/api/growth/health`

## Operating sequence

1. Collect the last seven complete Pacific/Auckland calendar days from Meta.
2. Read timestamped commercial accounts from Core.
3. Attribute outcomes only when an exact campaign identifier persists to the account.
4. Keep unassigned outcomes visible without crediting a campaign.
5. Evaluate each campaign with deterministic pause, reduce, hold and scale rules.
6. Atomically replace the current snapshot and append the full run to the audit ledger.
7. Surface failures and decisions in HQ.

## AI role

The deterministic worker builds trusted numbers. The local OpenClaw agent, authenticated as `ai@betman.co.nz`, consumes the snapshot to:

- explain the primary constraint;
- design controlled experiments;
- draft creative and landing-page variants;
- maintain the experiment backlog;
- request or execute approved actions only through the guarded control layer.

Credentials stay in host-owned protected configuration and must never appear in prompts, logs, repositories or chat.

## Promotion gates

### Observe to Recommend

- seven consecutive healthy collection days;
- campaign totals reconcile with Meta;
- signup timestamps and tester exclusions verified;
- no secret material in output or logs.

### Recommend to Draft

- campaign IDs persist through signup;
- trial and paid events are available;
- landing-page experiments have stable identifiers;
- all generated campaign changes remain unpublished drafts.

### Draft to Execute

- explicit production approval;
- separate least-privilege Meta write identity;
- tested rollback and idempotency;
- daily spend ceiling and campaign allowlist;
- two-person-visible audit trail;
- automatic disable on stale data, source disagreement or error-rate breach.
