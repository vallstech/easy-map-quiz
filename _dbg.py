import os, re
os.chdir(os.path.dirname(os.path.abspath(__file__)))
h = open('dist/index.html', encoding='utf-8').read()
m = re.search(r'const FONTS=\{(.*?)\};', h, re.S)
print('FONTS =', m.group(1) if m else 'NOT FOUND')
m = re.search(r"st\.setProperty\('--font',([^)]*)\)", h)
print('--font set from:', m.group(1) if m else 'NOT FOUND')
for mm in re.finditer(r'--font:[^;}\n]*', h):
    print('css --font:', mm.group(0)[:160])
# what does the UI panel use for its own labels?
m = re.search(r"#ui label[^}]*\}", h)
print('#ui label rule:', m.group(0) if m else 'none')
m = re.search(r'\.sec h2\{[^}]*\}', h)
print('.sec h2:', m.group(0) if m else 'none')
m = re.search(r'\.box h1\{[^}]*\}', h)
print('.box h1:', m.group(0) if m else 'none')
