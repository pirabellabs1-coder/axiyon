# axion-cli

Command-line interface for [Axion](https://axion.ai). Hire agents, deploy workflows, debug runs — all from your terminal.

## Install

```bash
curl -sSL get.axion.ai | sh   # one-line installer
# or
pip install axion-cli
```

## Quick start

```bash
axion auth login              # paste your axn_live_... key
axion agents catalog          # browse the 200+ template catalog
axion agents hire sdr-outbound --name Iris --budget 500
axion init my-app             # scaffold a workflow YAML
axion workflows deploy my-app/axion.yaml
axion workflows run deal-flow --wait
axion workflows logs <run_id> --follow
```

## Commands

```
axion auth login              Save credentials to ~/.axion/credentials.json
axion auth status             Show current login
axion auth logout

axion agents catalog          List the agent catalog
axion agents list             List your hired agents
axion agents hire <slug>      Hire an agent
axion agents run <id> -o "..." Trigger an ad-hoc run
axion agents pause <id>
axion agents resume <id>

axion workflows deploy file   Create + (optionally) publish from YAML/JSON
axion workflows run <slug>    Run a published workflow
axion workflows logs <run>    Stream the step trace

axion tasks get <id>          Inspect a task
axion tasks list              List recent tasks

axion init <name>             Scaffold a new project
axion dev                     Run the local sandbox
axion open dashboard|docs|status
```

## Configuration

Credentials live at `~/.axion/credentials.json` (chmod 600).
Override with `AXION_API_KEY`, `AXION_BASE_URL`, `AXION_ORG_ID`.

## License

MIT.
