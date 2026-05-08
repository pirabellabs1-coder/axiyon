"""axion CLI — top-level entry."""
from __future__ import annotations

import json
import os
import sys
import webbrowser
from pathlib import Path

import typer
import yaml
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from axion import Axion, Workflow
from axion.errors import AxionError

app = typer.Typer(
    name="axion",
    help="Axion CLI — hire AI employees, run workflows, debug from the terminal.",
    no_args_is_help=True,
)
agents_app = typer.Typer(name="agents", help="Manage agents.")
workflows_app = typer.Typer(name="workflows", help="Manage workflows.")
tasks_app = typer.Typer(name="tasks", help="Inspect tasks.")
auth_app = typer.Typer(name="auth", help="Authentication & API keys.")

app.add_typer(agents_app, name="agents")
app.add_typer(workflows_app, name="workflows")
app.add_typer(tasks_app, name="tasks")
app.add_typer(auth_app, name="auth")

console = Console()
err = Console(stderr=True, style="bold red")

CONFIG_DIR = Path.home() / ".axion"
CONFIG_FILE = CONFIG_DIR / "credentials.json"


def _load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def _save_config(cfg: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2))
    CONFIG_FILE.chmod(0o600)


def _client() -> Axion:
    cfg = _load_config()
    api_key = os.environ.get("AXION_API_KEY") or cfg.get("api_key")
    base_url = os.environ.get("AXION_BASE_URL") or cfg.get("base_url")
    org_id = os.environ.get("AXION_ORG_ID") or cfg.get("org_id")
    if not api_key:
        err.print("Not logged in. Run [bold]axion auth login[/bold] first.")
        raise typer.Exit(1)
    return Axion(api_key=api_key, base_url=base_url, org_id=org_id)


# ─── auth ────────────────────────────────────────────────────────


@auth_app.command("login")
def auth_login(
    api_key: str = typer.Option(..., prompt=True, hide_input=True, help="Your axn_live_... key"),
    base_url: str = typer.Option(None, help="Override for self-hosted Axion"),
    org_id: str = typer.Option(None, help="Active org ID for multi-org accounts"),
) -> None:
    """Save credentials to ~/.axion/credentials.json."""
    cfg = _load_config()
    cfg["api_key"] = api_key
    if base_url:
        cfg["base_url"] = base_url
    if org_id:
        cfg["org_id"] = org_id
    _save_config(cfg)
    console.print(":white_check_mark: [green]Credentials saved.[/green]")


@auth_app.command("status")
def auth_status() -> None:
    cfg = _load_config()
    if not cfg.get("api_key"):
        err.print("Not logged in.")
        raise typer.Exit(1)
    console.print(Panel.fit(
        f"API key: [bold]{cfg['api_key'][:12]}…[/bold]\n"
        f"Base URL: {cfg.get('base_url') or 'https://api.axion.ai/v1'}\n"
        f"Org: {cfg.get('org_id') or '(default)'}",
        title="Axion auth status",
        border_style="cyan",
    ))


@auth_app.command("logout")
def auth_logout() -> None:
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()
    console.print("[green]Logged out.[/green]")


@app.command()
def open(target: str = typer.Argument("dashboard", help="dashboard | docs | status")) -> None:
    """Open the Axion console / docs / status page in your browser."""
    urls = {
        "dashboard": "https://app.axion.ai",
        "docs": "https://docs.axion.ai",
        "status": "https://status.axion.ai",
        "trust": "https://trust.axion.ai",
    }
    url = urls.get(target, target)
    console.print(f"Opening [cyan]{url}[/cyan]…")
    webbrowser.open(url)


# ─── agents ──────────────────────────────────────────────────────


@agents_app.command("catalog")
def agents_catalog(
    category: str = typer.Option(None, help="Filter by category"),
    q: str = typer.Option(None, help="Search query"),
) -> None:
    """List the agent template catalog."""
    ax = _client()
    items = ax.agents.catalog(category=category, q=q)
    table = Table(title=f"Agent catalog ({len(items)} templates)")
    table.add_column("Slug", style="cyan")
    table.add_column("Name", style="bold")
    table.add_column("Role")
    table.add_column("Category")
    table.add_column("€/mo", justify="right")
    for t in items:
        table.add_row(t["slug"], t["name"], t["role"], t["category"], str(t["price_eur_monthly"]))
    console.print(table)


@agents_app.command("list")
def agents_list() -> None:
    ax = _client()
    items = ax.agents.list()
    table = Table(title=f"Agents ({len(items)} active)")
    table.add_column("ID", style="dim")
    table.add_column("Name", style="bold")
    table.add_column("Template")
    table.add_column("Status")
    table.add_column("Health", justify="right")
    table.add_column("Tasks today", justify="right")
    for a in items:
        table.add_row(
            a["id"][:8] + "…",
            a["name"],
            a["template_slug"],
            a["status"],
            f"{a['health_score']*100:.0f}%",
            str(a["tasks_today"]),
        )
    console.print(table)


@agents_app.command("hire")
def agents_hire(
    template: str = typer.Argument(..., help="Template slug, e.g. sdr-outbound"),
    name: str = typer.Option(..., "--name", "-n", help="Display name for this agent"),
    config: str = typer.Option(None, "--config", "-c", help="Path to JSON/YAML config file"),
    budget_per_day: int = typer.Option(100, "--budget", "-b"),
) -> None:
    """Hire an agent from the catalog."""
    cfg: dict = {}
    if config:
        text = Path(config).read_text()
        cfg = yaml.safe_load(text) if config.endswith((".yml", ".yaml")) else json.loads(text)

    ax = _client()
    try:
        result = ax.agents.hire(
            template=template, name=name, config=cfg, budget_per_day=budget_per_day
        )
    except AxionError as e:
        err.print(f"Failed to hire: {e}")
        raise typer.Exit(1) from None
    console.print(f":white_check_mark: Hired [bold cyan]{result['name']}[/bold cyan] · ID {result['id']}")


@agents_app.command("run")
def agents_run(
    agent_id: str = typer.Argument(..., help="Agent UUID"),
    objective: str = typer.Option(..., "--objective", "-o"),
    inputs: str = typer.Option(None, "--inputs", "-i", help="JSON string of inputs"),
) -> None:
    """Trigger an ad-hoc run on an agent."""
    payload = json.loads(inputs) if inputs else {}
    ax = _client()
    task = ax.agents.run(agent_id, objective=objective, inputs=payload)
    console.print(f":rocket: Task [cyan]{task['id']}[/cyan] queued. Track with [bold]axion tasks get {task['id']}[/bold]")


@agents_app.command("pause")
def agents_pause(agent_id: str) -> None:
    _client().agents.pause(agent_id)
    console.print("[yellow]paused[/yellow]")


@agents_app.command("resume")
def agents_resume(agent_id: str) -> None:
    _client().agents.resume(agent_id)
    console.print("[green]resumed[/green]")


# ─── workflows ───────────────────────────────────────────────────


@workflows_app.command("deploy")
def workflows_deploy(
    file: Path = typer.Argument(..., exists=True, help="Path to workflow YAML/JSON"),
    publish: bool = typer.Option(True, "--publish/--no-publish"),
) -> None:
    """Create a workflow from a YAML/JSON file and (optionally) publish it."""
    text = file.read_text()
    parsed = yaml.safe_load(text) if file.suffix in (".yml", ".yaml") else json.loads(text)

    slug = parsed.pop("slug", None) or parsed.get("name", "").lower().replace(" ", "-")
    spec = parsed.get("spec", parsed)

    ax = _client()
    wf = ax.workflows.create(slug, spec)
    console.print(f":white_check_mark: Created [cyan]{wf['slug']}[/cyan] v{wf['version']}")
    if publish:
        ax.workflows.publish(slug)
        console.print(":rocket: Published.")


@workflows_app.command("run")
def workflows_run(
    slug: str = typer.Argument(...),
    inputs: str = typer.Option(None, "--inputs", "-i", help="JSON string"),
    wait: bool = typer.Option(False, "--wait", help="Block until terminal state"),
) -> None:
    payload = json.loads(inputs) if inputs else {}
    ax = _client()
    run = ax.workflows.run(slug, inputs=payload)
    console.print(f":rocket: Run [cyan]{run['id']}[/cyan] dispatched.")
    if wait:
        with console.status("Running…"):
            final = ax.workflows.wait_for_run(run["id"])
        console.print_json(data=final)


@workflows_app.command("logs")
def workflows_logs(
    run_id: str = typer.Argument(...),
    follow: bool = typer.Option(False, "--follow", "-f"),
) -> None:
    """Stream a run's step trace."""
    import time
    ax = _client()
    seen: set[str] = set()
    while True:
        steps = ax.workflows.get_run_steps(run_id)
        for s in steps:
            sid = s["id"]
            if sid in seen:
                continue
            seen.add(sid)
            color = {
                "succeeded": "green",
                "failed": "red",
                "running": "cyan",
                "awaiting_approval": "yellow",
            }.get(s["status"], "dim")
            console.print(
                f"[dim]{s.get('started_at','—')[-12:]:>12}[/dim] "
                f"[{color}]{s['status']:>16}[/{color}] · "
                f"step {s['step_index']:>2} · {s['step_id']}"
            )
        if not follow:
            break
        run = ax.workflows.get_run(run_id)
        if run["status"] in ("succeeded", "failed", "cancelled"):
            console.print(f"\n[bold]Final:[/bold] {run['status']}")
            break
        time.sleep(2)


# ─── tasks ───────────────────────────────────────────────────────


@tasks_app.command("get")
def tasks_get(task_id: str = typer.Argument(...)) -> None:
    ax = _client()
    t = ax.tasks.get(task_id)
    console.print_json(data=t)


@tasks_app.command("list")
def tasks_list(
    status: str = typer.Option(None),
    limit: int = typer.Option(20),
) -> None:
    ax = _client()
    items = ax.tasks.list(status=status, limit=limit)
    table = Table(title=f"Tasks ({len(items)})")
    table.add_column("ID", style="dim")
    table.add_column("Status")
    table.add_column("Agent")
    table.add_column("€", justify="right")
    table.add_column("Objective", style="cyan")
    for t in items:
        table.add_row(
            t["id"][:8] + "…",
            t["status"],
            t["agent_id"][:8] + "…",
            f"{t['cost_eur']:.4f}",
            (t["objective"] or "")[:60],
        )
    console.print(table)


# ─── dev / scaffolding ───────────────────────────────────────────


@app.command()
def init(
    name: str = typer.Argument("my-axion-app"),
    path: Path = typer.Option(Path("."), "--path", "-p"),
) -> None:
    """Scaffold a new Axion project (workflow YAML + sample script)."""
    target = path / name
    target.mkdir(parents=True, exist_ok=True)
    sample_yaml = target / "axion.yaml"
    sample_yaml.write_text(
        """name: deal-flow
slug: deal-flow
spec:
  name: deal-flow
  description: Weekly outbound
  schedule_cron: "0 9 * * 1"
  steps:
    - id: source
      agent: sdr-outbound
      action: source_leads
      params: { n: 100 }
    - id: qualify
      agent: cfo-assistant
      action: qualify_margin
      params: { margin_threshold_eur: 80000 }
      depends_on: [source]
    - id: book
      agent: sdr-outbound
      action: book_demos
      depends_on: [qualify]
      requires_approval: true
      approval_threshold_eur: 50000
  on_blocker:
    escalate_to: founder@helia.io
  max_cost_eur: 20
"""
    )
    console.print(f":sparkles: [green]Scaffolded[/green] {name}/ with [cyan]axion.yaml[/cyan]")


@app.command()
def dev() -> None:
    """Run the local dev sandbox (requires backend installed)."""
    console.print(":rocket: Starting Axion dev sandbox on [cyan]http://localhost:8000[/cyan]…")
    try:
        os.execvp("axion-api", ["axion-api"])
    except FileNotFoundError:
        err.print(
            "Could not find [bold]axion-api[/bold]. Install the backend with "
            "[cyan]pip install axion[backend][/cyan] or run from the source tree."
        )
        raise typer.Exit(1) from None


def main() -> None:
    try:
        app()
    except AxionError as e:
        err.print(f"Axion error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
