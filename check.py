"""Basic JS sanity checks for the built bundle (no Node needed).

Every check here exists because of a real bug that shipped:
  1. a "let" declaration appearing twice in the same scope -> SyntaxError, and the whole
     appended module silently never runs (that is how the Interface panel broke);
  2. an id the scripts query that the markup does not have.
The checks are heuristic (a real parser is the only authority), but they catch exactly the
mistake class that has bitten this file.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(HERE, "dist", "index.html"), encoding="utf-8").read()
markup = html[:html.index("<script>")]
js = "".join(re.findall(r"<script>(.*?)</script>", html, re.S))

fail = []


def modules(text):
    """[(name, body)] for each banner-delimited module, plus the code without banners."""
    marks = [(m.group(1), m.start(), m.end()) for m in re.finditer(r"\n/\* =+\n   (\S+)\n   =+ \*/\n", text)]
    out = []
    for i, (name, _s, e) in enumerate(marks):
        end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
        out.append((name, text[e:end]))
    return out


def top_level_names(body):
    """Names declared at the top level of a body (brace/paren depth 0), skipping the
    contents of IIFEs and functions, which have their own scope."""
    names, i, n, depth = [], 0, len(body), 0
    while i < n:
        c = body[i]
        if c in '"\'':
            q, i = c, i + 1
            while i < n:
                if body[i] == "\\":
                    i += 2
                    continue
                if body[i] == q:
                    i += 1
                    break
                i += 1
            continue
        if c == "`":
            i += 1
            while i < n:
                if body[i] == "\\":
                    i += 2
                    continue
                if body[i] == "`":
                    i += 1
                    break
                i += 1
            continue
        if body.startswith("/*", i):
            i = body.find("*/", i) + 2
            continue
        if body.startswith("//", i):
            i = body.find("\n", i)
            continue
        if c in "{([":
            if c == "{" and depth == 0:
                pass
            depth += 1
            i += 1
            continue
        if c in "})]":
            depth -= 1
            i += 1
            continue
        if depth == 0:
            m = re.match(r"(?:let|const|var|function|class)\s+([A-Za-z_$][\w$]*)", body[i:])
            if m and (i == 0 or not re.match(r"[\w$.]", body[i - 1])):
                names.append(m.group(1))
                i += m.end()
                continue
        i += 1
    return names


# --- 1. duplicate declarations in the same (top-level) scope of a module -----------
for name, body in modules(js):
    names = top_level_names(body)
    dupes = sorted({x for x in names if names.count(x) > 1})
    if dupes:
        fail.append("%s: duplicate top-level declaration(s): %s" % (name, ", ".join(dupes)))

# --- 2. balanced braces/parens/brackets per module ---------------------------------
for name, body in modules(js):
    stripped = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
    stripped = re.sub(r'"(?:[^"\\]|\\.)*"', '""', stripped)
    stripped = re.sub(r"'(?:[^'\\]|\\.)*'", "''", stripped)
    stripped = re.sub(r"`(?:[^`\\]|\\.)*`", "``", stripped)
    stripped = re.sub(r"//[^\n]*", "", stripped)
    for o, c in (("{", "}"), ("(", ")"), ("[", "]")):
        if stripped.count(o) != stripped.count(c):
            fail.append("%s: unbalanced %s%s (%d vs %d)" % (name, o, c, stripped.count(o), stripped.count(c)))

# --- 3. every id the scripts look up must exist in the markup ----------------------
ids = set(re.findall(r'\bid="([^"]+)"', markup))
used = set(re.findall(r"\$\('([^']+)'\)", js))
for lit, var in re.findall(r"\[((?:\s*'[^']+'\s*,?)+)\]\s*\.forEach\(\s*(\w+)\s*=>", js):
    if re.search(r"\$\(" + var + r"\)", js):
        used |= set(re.findall(r"'([^']+)'", lit))
used = {u for u in used if not u.startswith("ui")}      # the panel builds its own ids
missing = sorted(u for u in used if u not in ids)
if missing:
    fail.append("ids queried but not in the markup: " + ", ".join(missing))

print("modules in the bundle:", len(modules(js)))
print("ids queried: %d, in the markup: %d" % (len(used), len(ids)))
if fail:
    print("\nFAILED:")
    for f in fail:
        print("  -", f)
    sys.exit(1)
print("all checks passed")
