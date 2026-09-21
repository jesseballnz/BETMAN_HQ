# BETMAN Growth Agent

The Growth Agent is BETMAN-WORKER's first autonomous commercial capability. Its north-star metric is retained paid customers, not clicks or post engagement.

## Safety model

The first release is permanently dry-run. It reads Meta, Core and Stripe, writes a local snapshot and append-only audit ledger, and produces deterministic recommendations. It contains no Meta or Stripe write path.

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
- Platform: macOS 15 on Intel, using a user-level launchd agent
- User: `jesseball`; the Growth Agent does not run as root
- Release: `~/BETMAN/betman-hq-growth-agent`
- Service: `ai.betman.growth-agent`
- Schedule: every four hours at minute 17 and once when loaded
- Protected configuration: `~/Library/Application Support/BETMAN/growth-agent.env` (`0600`)
- Snapshot: `~/BETMAN/betman-hq-growth-agent/runtime/growth-agent/latest.json`
- Audit ledger: `~/BETMAN/betman-hq-growth-agent/runtime/growth-agent/audit.jsonl`
- HQ route: `/growth`
- Health route: `/api/growth/health`

The launchd service is intentionally separate from `ai.openclaw.gateway`. Installing or
running the Growth Agent must not restart the OpenClaw gateway or any existing BETMAN
trading agent.

## Operations

```bash
# Inspect service state
launchctl print gui/$(id -u)/ai.betman.growth-agent

# Run an immediate scheduled cycle
launchctl kickstart -k gui/$(id -u)/ai.betman.growth-agent

# Read logs
tail -100 ~/Library/Logs/BETMAN/growth-agent.out.log
tail -100 ~/Library/Logs/BETMAN/growth-agent.err.log
```

An idle `not running` state with `last exit code = 0` is healthy because the service is
a scheduled one-shot. Any source failure writes an unhealthy snapshot, appends it to the
ledger and exits non-zero. Restore the source first, then run a new cycle; never delete
the audit ledger.

## Operating sequence

1. Collect the last seven complete Pacific/Auckland calendar days from Meta.
2. Read timestamped commercial accounts from Core.
3. Read confirmed active paid customers from Stripe and match them to Core by normalized email until Stripe customer IDs are exposed by the HQ summary.
4. Attribute outcomes only when an exact Meta campaign identifier persists to the account.
5. Keep assigned-but-unmatched and unassigned outcomes visible without crediting a campaign.
6. Publish campaign-assignment, exact-signup, trial and paid-match coverage.
7. Evaluate each campaign with deterministic pause, reduce, hold and scale rules.
8. Atomically replace the current snapshot and append the full run to the audit ledger.
9. Surface failures, coverage and decisions in HQ.

## OpenClaw skill stack

- `growth-supervisor`
- `growth-attribution-controller`
- `growth-experiment-controller`
- `growth-creative-laboratory`
- `growth-conversion-optimizer`
- `growth-unit-economics`
- `growth-reliability-controller`
- `weekly-ad-growth-report`
- `trial-conversion-funnel`
- `production-change-guardrail`

The supervisor selects one commercial constraint per cycle and routes it to the narrowest specialist. Skills propose and evaluate work; deterministic code still controls permissions, spend and promotion.

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

- seven consecutive healthy Meta, Core and Stripe collection days;
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
