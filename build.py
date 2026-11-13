#!/usr/bin/env python3
"""Build dist/index.html = src/template.html (shell + base CSS) + src/skin.css + src/js/**.js + Natural Earth GeoJSON maps, all inlined.

Source layout
    src/template.html    page shell: markup + base (engine) CSS. Placeholders:
                           /*__DATA__*/{}  and  /*__FLAGS__*/{}  are replaced in place,
                           /*__FONT__*/    (font-face), /*__CSS__*/ (skin) and /*__SCRIPTS__*/ (all modules) are substituted.
    src/skin.css         the design (inlined where /*__CSS__*/ is)
    src/js/              behaviour, one file per concern; inlined in the order of the JS list below.
    src/panel.js         legacy monolithic build — used only if src/js/ is missing.
    data/geojson/        ne_*_admin_0_countries prints. data/flags/*.svg. data/fonts/*.ttf.

Usage
    python build.py                                # every data/geojson/<key>.geojson (e.g. 110.geojson and 50.geojson)
    python build.py 110=a.geojson 50=b.geojson     # or pass files explicitly (key=path)
Keys become the "Map detail" choices in the game (110 = low detail, 50 = high detail).
Stdlib only.
"""
import base64, glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
S = 4  # world units per degree; must match S_ in src/js/core/config.js
CONT = {"Europe", "Asia", "Africa", "North America", "South America", "Oceania"}
TYPES = {"Sovereign country", "Country", "Sovereignty", "Disputed"}  # skips Dependency / Lease / Indeterminate
# Natural Earth leaves ISO_A2 = -99 for a few countries; patch by ADM0_A3.
FIX = {"FRA": "FR", "NOR": "NO", "KOS": "XK", "CNM": None, "SOL": None}
# Micro-states missing from 110m data are added as marker-only entries: iso2: (name, region, lon, lat)
MICRO = {
    "VA": ("Vatican City", "Europe", 12.45, 41.9), "SM": ("San Marino", "Europe", 12.46, 43.94),
    "MC": ("Monaco", "Europe", 7.42, 43.74), "LI": ("Liechtenstein", "Europe", 9.55, 47.16),
    "AD": ("Andorra", "Europe", 1.52, 42.55), "MT": ("Malta", "Europe", 14.4, 35.9),
    "SG": ("Singapore", "Asia", 103.82, 1.35), "BH": ("Bahrain", "Asia", 50.55, 26.07),
    "MV": ("Maldives", "Asia", 73.5, 3.2), "MU": ("Mauritius", "Africa", 57.55, -20.35),
    "SC": ("Seychelles", "Africa", 55.45, -4.68), "KM": ("Comoros", "Africa", 43.33, -11.65),
    "ST": ("São Tomé and Príncipe", "Africa", 6.61, 0.19), "CV": ("Cabo Verde", "Africa", -23.6, 15.1),
    "BB": ("Barbados", "North America", -59.55, 13.19), "LC": ("Saint Lucia", "North America", -60.98, 13.91),
    "VC": ("Saint Vincent and the Grenadines", "North America", -61.2, 13.25),
    "GD": ("Grenada", "North America", -61.68, 12.12), "AG": ("Antigua and Barbuda", "North America", -61.8, 17.06),
    "DM": ("Dominica", "North America", -61.37, 15.41), "KN": ("Saint Kitts and Nevis", "North America", -62.78, 17.36),
    "MH": ("Marshall Islands", "Oceania", 171.2, 7.1), "FM": ("Micronesia", "Oceania", 158.2, 6.9),
    "PW": ("Palau", "Oceania", 134.6, 7.5), "NR": ("Nauru", "Oceania", 166.93, -0.52),
    "TV": ("Tuvalu", "Oceania", 179.2, -8.5), "KI": ("Kiribati", "Oceania", 173.0, 1.4),
    "TO": ("Tonga", "Oceania", -175.2, -21.18), "WS": ("Samoa", "Oceania", -172.1, -13.76),
}


# UN sub-regions of the micro-states added by build_map() (Natural Earth's SUBREGION naming)
SUB = {"VA": "Southern Europe", "SM": "Southern Europe", "AD": "Southern Europe", "MT": "Southern Europe", "MC": "Western Europe",
       "LI": "Western Europe", "SG": "South-Eastern Asia", "BH": "Western Asia", "MV": "Southern Asia", "MU": "Eastern Africa",
       "SC": "Eastern Africa", "KM": "Eastern Africa", "ST": "Middle Africa", "CV": "Western Africa", "BB": "Caribbean",
       "LC": "Caribbean", "VC": "Caribbean", "GD": "Caribbean", "AG": "Caribbean", "DM": "Caribbean", "KN": "Caribbean",
       "MH": "Micronesia", "FM": "Micronesia", "PW": "Micronesia", "NR": "Micronesia", "KI": "Micronesia", "TV": "Polynesia",
       "TO": "Polynesia", "WS": "Polynesia"}

# src/js/**/*.js are concatenated in this order. `None` marks the spot of a sub-directory:
# every *.js inside it, sorted by name, is inserted there.
LAYOUT = ["core", None, "game", None, "ui", None]
JS_ORDER = {"core": ["config.js", "map.js", "camera.js"],
            "game": ["game.js", "keys.js"],
            "ui": ["screens.js", "panel.js"]}
JS_FILES = ["main.js"]


def js_sources():
    """[(relative path, source)] in load order. Falls back to the legacy single file if src/js/ is gone."""
    root = os.path.join(HERE, "src", "js")
    if not os.path.isdir(root):
        return [("src/panel.js", open(os.path.join(HERE, "src", "panel.js"), encoding="utf-8").read())]
    out = []
    for item in LAYOUT:
        if item is None:
            continue
        sub = os.path.join(root, item)
        for name in JS_ORDER.get(item, sorted(os.listdir(sub))):
            p = os.path.join(sub, name)
            if os.path.isfile(p):
                out.append((os.path.relpath(p, HERE).replace("\\", "/"), open(p, encoding="utf-8").read()))
    for name in JS_FILES:
        p = os.path.join(root, name)
        if os.path.isfile(p):
            out.append((os.path.relpath(p, HERE).replace("\\", "/"), open(p, encoding="utf-8").read()))
    return out


def scripts():
    """All modules as one <script> body, separated by banners naming their source file."""
    parts = []
    for path, src in js_sources():
        bar = "/* " + "=" * 74 + "\n   " + path + "\n   " + "=" * 74 + " */"
        parts.append(bar + "\n" + src.rstrip("\n"))
    return "\n\n".join(parts) + "\n"


def polys(g):
    if g["type"] == "Polygon":
        return [g["coordinates"]]
    if g["type"] == "MultiPolygon":
        return g["coordinates"]
    return []


def convert(feat):
    P = {k.upper(): v for k, v in feat["properties"].items()}
    iso = next((P[k] for k in ("ISO_A2_EH", "ISO_A2", "WB_A2") if isinstance(P.get(k), str) and re.fullmatch(r"[A-Z]{2}", P[k])), None)
    iso = iso or FIX.get(P.get("ADM0_A3") or P.get("ISO_A3"))
    reg = P.get("CONTINENT")
    if not iso or reg not in CONT or ("TYPE" in P and P["TYPE"] not in TYPES):
        return None
    d, best = [], (-1, None)
    for poly in polys(feat["geometry"]):
        for ring in poly:
            pts = [(round((x + 180) * S, 1), round((90 - y) * S, 1)) for x, y in ring]
            d.append("M" + "L".join(f"{x} {y}" for x, y in pts) + "Z")
        xs, ys = [p[0] for p in poly[0]], [p[1] for p in poly[0]]
        a = (max(xs) - min(xs)) * (max(ys) - min(ys))
        if a > best[0]:
            best = (a, poly[0])
    ring = best[1]
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    c = [round(((max(xs) + min(xs)) / 2 + 180) * S, 1), round((90 - (max(ys) + min(ys)) / 2) * S, 1)]
    return {"id": iso, "n": P.get("NAME") or P.get("NAME_EN") or iso, "r": reg, "d": "".join(d), "c": c,
            "a": round((max(xs) - min(xs)) * (max(ys) - min(ys)), 2),
            "s": P.get("SUBREGION") or None,
            "b": [round((min(xs) + 180) * S, 1), round((90 - max(ys)) * S, 1), round((max(xs) + 180) * S, 1), round((90 - min(ys)) * S, 1)]}


def build_map(path):
    """One GeoJSON -> sorted list of compact country dicts (+ marker-only micro-states missing from the file)."""
    gj = json.load(open(path, encoding="utf-8"))
    out = {}
    for f in gj["features"]:
        c = convert(f)
        if c and (c["id"] not in out or c["a"] > out[c["id"]]["a"]):
            out[c["id"]] = c
    for iso, (n, r, lon, lat) in MICRO.items():
        if iso not in out:
            out[iso] = {"id": iso, "n": n, "r": r, "d": "", "c": [round((lon + 180) * S, 1), round((90 - lat) * S, 1)], "a": 0, "s": SUB.get(iso)}
    return sorted(out.values(), key=lambda c: c["id"])


def find_sources():
    """{key: path}. CLI: key=path ... ; default: every data/geojson/<key>.geojson (key = file name, e.g. 50 and 110)."""
    args = [a for a in sys.argv[1:] if "=" in a]
    if args:
        return {a.split("=", 1)[0]: a.split("=", 1)[1] for a in args}
    files = glob.glob(os.path.join(HERE, "data", "geojson", "*.geojson")) + glob.glob(os.path.join(HERE, "data", "geojson", "*.json"))
    return {os.path.splitext(os.path.basename(p))[0]: p for p in sorted(files)}


def main():
    sources = find_sources()
    if not sources:
        sys.exit("No GeoJSON found. Put 110.geojson and/or 50.geojson (Natural Earth admin_0_countries) into data/geojson/ (see README.md).")
    maps = {}
    for key, path in sources.items():
        maps[key] = build_map(path)
        print(f"map {key}: {len(maps[key])} countries ({os.path.basename(path)})")
    flags = {}
    for p in glob.glob(os.path.join(HERE, "data", "flags", "*.svg")):
        flags[os.path.basename(p)[:-4].upper()] = "data:image/svg+xml;base64," + base64.b64encode(open(p, "rb").read()).decode()
    html = open(os.path.join(HERE, "src", "template.html"), encoding="utf-8").read()
    # Optional colour flag font (data/fonts/*.ttf): inlined and used only for regional-indicator (flag) characters.
    font = ""
    for p in sorted(glob.glob(os.path.join(HERE, "data", "fonts", "*.ttf"))):
        font += "@font-face{font-family:Flags;unicode-range:U+1F1E6-1F1FF;src:url(data:font/ttf;base64," + base64.b64encode(open(p, "rb").read()).decode() + ")}"
        break
    # The skin (src/skin.css) and every src/js/ module are kept as separate source files and inlined here -> one index.html
    css = open(os.path.join(HERE, "src", "skin.css"), encoding="utf-8").read()
    srcs = js_sources()
    html = html.replace("/*__FONT__*/", font)
    html = html.replace("/*__CSS__*/", css)
    html = html.replace("/*__SCRIPTS__*/", scripts())
    html = html.replace("/*__DATA__*/{}", json.dumps(maps, ensure_ascii=False, separators=(",", ":")))
    html = html.replace("/*__FLAGS__*/{}", json.dumps(flags, separators=(",", ":")))
    os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
    dst = os.path.join(HERE, "dist", "index.html")
    open(dst, "w", encoding="utf-8", newline="\n").write(html)
    print(f"js: {len(srcs)} modules, {sum(len(s) for _, s in srcs)} bytes -> {', '.join(p.rsplit('/', 1)[-1] for p, _ in srcs)}")
    print(f"{len(flags)} svg flags -> {dst} ({os.path.getsize(dst)//1024} KB)")
    # sanity checks: a duplicated top-level declaration in the concatenated bundle is a
    # SyntaxError that makes the whole appended module silently never run.
    import subprocess
    rc = subprocess.call([sys.executable, os.path.join(HERE, "check.py")])
    if rc:
        sys.exit("check.py failed - the bundle is NOT safe to run")


if __name__ == "__main__":
    main()
