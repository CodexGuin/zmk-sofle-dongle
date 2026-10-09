# Compare a .keymap file's layers against a ZMK Studio live dump, position by position.
# usage: python3 verify_keymap.py config/eyelash_sofle.keymap dump.json  (dump from dump-keymap.mjs)
import json, re, sys
keymap, dump = sys.argv[1], sys.argv[2]
src = open(keymap).read()
layers = re.findall(r'bindings = <\n(.*?)\n\s*>;', src.split('keymap {', 1)[1], re.S)
toks = [re.findall(r'&\w+(?:\s+(?!&)[^\s&]+)*', l) for l in layers]
# HID usages (page 7 keyboard, page 0x0C consumer) for keys this keymap uses
K = {**{c: 4 + i for i, c in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZ')},
     **{f'N{d}': 0x1E + (d - 1) % 10 for d in range(1, 11)}, 'N0': 0x27,
     **{f'F{n}': 0x3A + n - 1 for n in range(1, 13)}, **{f'F{n}': 0x68 + n - 13 for n in range(13, 25)},
     'RET': 0x28, 'ESC': 0x29, 'BSPC': 0x2A, 'TAB': 0x2B, 'SPACE': 0x2C, 'MINUS': 0x2D, 'EQUAL': 0x2E,
     'LBKT': 0x2F, 'RBKT': 0x30, 'BSLH': 0x31, 'SEMI': 0x33, 'APOS': 0x34, 'GRAVE': 0x35, 'COMMA': 0x36,
     'DOT': 0x37, 'FSLH': 0x38, 'PSCRN': 0x46, 'HOME': 0x4A, 'DEL': 0x4C, 'END': 0x4D, 'RIGHT': 0x4F,
     'LEFT': 0x50, 'DOWN': 0x51, 'UP': 0x52, 'LCTRL': 0xE0, 'LSHFT': 0xE1, 'LALT': 0xE2, 'LGUI': 0xE3,
     'RCTRL': 0xE4, 'RSHFT': 0xE5, 'RALT': 0xE6, 'RGUI': 0xE7}
C = {'C_PP': 0xCD, 'C_NEXT': 0xB5, 'C_PREV': 0xB6}
MODS = {'LC': 0x01, 'LS': 0x02, 'LA': 0x04, 'LG': 0x08}
def kc(s):
    m = re.fullmatch(r'(L[CSAG])\((\w+)\)', s)
    if m: return (MODS[m[1]] << 24) | kc(m[2])
    return (0x0C << 16 | C[s]) if s in C else (0x07 << 16 | K[s])
NAMES = {'&kp': 'Key Press', '&to': 'To Layer', '&mo': 'Momentary Layer', '&sl': 'Sticky Layer',
         '&trans': 'Transparent', '&none': 'None', '&mmv': 'mouse_move', '&mkp': 'Mouse Key Press', '&rt_macro': 'Runtime Macro', '&email': 'Email'}
d = json.load(open(dump))
bad = n = 0
for li, (lt, ld) in enumerate(zip(toks, d['layers'])):
    assert len(lt) == len(ld['bindings']), (li, len(lt), len(ld['bindings']))
    for pos, (t, b) in enumerate(zip(lt, ld['bindings'])):
        n += 1
        parts = t.split()
        if parts[0] == '&hm':  # custom hold-tap: dump names it by node, params are hold mod / tap key
            ok = (b['param1'], b['param2']) == (kc(parts[1]), kc(parts[2]))
        elif parts[0] == '&mkp':
            ok = b['behavior'] == NAMES['&mkp'] and b['param1'] == {'MB1': 1, 'MB2': 2, 'MB3': 4}[parts[1]]
        elif parts[0] == '&mmv':
            ok = b['behavior'] == NAMES[parts[0]]  # params are pointing constants; behavior match suffices
        else:
            ok = b['behavior'] == NAMES[parts[0]]
            if ok and parts[0] == '&kp': ok = b['param1'] == kc(parts[1])
            elif ok and len(parts) > 1: ok = b['param1'] == int(parts[1])
        if not ok: bad += 1; print(f'MISMATCH layer {li} pos {pos}: file {t!r} vs live {b["behavior"]} {b["param1"]} {b["param2"]}')
print(f'{n} positions checked, {bad} mismatches')
sys.exit(1 if bad else 0)
