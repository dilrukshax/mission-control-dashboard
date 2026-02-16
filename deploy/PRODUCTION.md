# Mission Control - No-Docker Production Runbook

## 1) Prepare env

```bash
cd /home/dilan/mission-control-dashboard
cp .env.prod.example .env.prod
# edit .env.prod and set real keys/urls
```

## 2) Build once

```bash
./scripts/prod/build.sh
```

## 3) Install and start user services

```bash
./deploy/systemd/install-user-services.sh
```

If `DISCORD_BOT_TOKEN` is set in `.env.prod`, the Discord bridge bot service is also enabled automatically.

## 4) Verify

```bash
./scripts/prod/check.sh
```

Expected:
- API: `http://127.0.0.1:3001/api/health`
- Web: `http://<host-ip>:3000`

## Useful commands

```bash
systemctl --user restart mission-control-api
systemctl --user restart mission-control-web
systemctl --user restart mission-control-discord-bridge
journalctl --user -u mission-control-api -f
journalctl --user -u mission-control-web -f
journalctl --user -u mission-control-discord-bridge -f
```

## Discord bridge endpoint

Your Discord bot should post to:

`POST http://<host-ip>:3001/api/discord/bridge`

Header:
- `x-mc-key: <AUTH_OPERATOR_KEY or AUTH_OWNER_KEY>`

Payload should include at least:
- `channel_name`
- `content`
- `author_username`

Research intake trigger:
- message starts with `Research: ...`

Additional bridged channels:
- `company-policy` / `policy`
  - create note: `Policy: ...`
  - otherwise lookup in `00-Company/Policies` + `06-Decisions`
- `sales-enable` / `sales`
  - create note: `Sales: ...`
  - otherwise lookup in `03-Sales` + `01-Market`
- `ops-reliability` / `ops`
  - create note: `Ops: ...`
  - otherwise lookup in `05-Ops` + `06-Decisions`
