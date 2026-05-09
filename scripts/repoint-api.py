"""One-shot: repoint all client-side fetches/hrefs from /api/X to /api/v1/X."""
import os, re, sys

HUNG = ["agents", "integrations", "audit", "approvals", "workflows", "memory", "team", "auth", "tools", "chat"]
ROOTS = ["app", "components", "lib"]
SKIP_DIRS = {"node_modules", ".next", "app/api/v1", "app/api"}

def should_skip(path):
    p = path.replace("\\", "/")
    if "node_modules" in p or ".next" in p:
        return True
    # don't touch api routes themselves (they're server code; just docs strings)
    if p.startswith("app/api/"):
        return True
    return False

count = 0
for root in ROOTS:
    if not os.path.isdir(root):
        continue
    for dirpath, dirs, files in os.walk(root):
        if should_skip(dirpath):
            continue
        for f in files:
            if not f.endswith((".tsx", ".ts", ".jsx", ".js")):
                continue
            full = os.path.join(dirpath, f)
            with open(full, "r", encoding="utf-8", errors="replace") as fp:
                s = fp.read()
            orig = s
            for seg in HUNG:
                # quoted strings: "/api/seg" or "/api/seg/..."
                s = re.sub(r'(["\'])/api/' + seg + r'(/[^"\']*)?\1',
                           lambda m: m.group(1) + "/api/v1/" + seg + (m.group(2) or "") + m.group(1), s)
                # template literals (backticks): `/api/seg/...`
                s = re.sub(r'`/api/' + seg, r'`/api/v1/' + seg, s)
            if s != orig:
                with open(full, "w", encoding="utf-8", newline="\n") as fp:
                    fp.write(s)
                print(f"[updated] {full}")
                count += 1

print(f"\nTotal updated: {count}")
