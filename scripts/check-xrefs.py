#!/usr/bin/env python3
"""Every §x.y reference in the controller must resolve to something that exists.

§1.3's "tenth class" defect was exactly this: four sub-artifacts cited an ordinal
that resolved to nothing, because a list was folded from ten entries to nine and
the header was not recounted. Nothing checked it. This does.

Resolution differs by section and that is the whole difficulty: §1.x are headings,
§5.x are bold-prefixed ledger rows, §10.x / §6.x / §3.x / §8.x are numbered list
items inside their section, and §1.4.x are clauses inside §1.4.
"""
import re, sys
path = sys.argv[1] if len(sys.argv) > 1 else 'docs/goal-prompt.md'
s = open(path).read(); lines = s.splitlines()

headings = {m.group(1) for l in lines
            if (m := re.match(r'^#{2,4} §?([0-9]+(?:\.[0-9]+)?[a-z]?)\b', l))}
order = [(m.group(1), i) for i, l in enumerate(lines)
         if (m := re.match(r'^## §?([0-9]+|CHANGELOG)\b', l))]
bounds = {n: (i, order[k+1][1] if k+1 < len(order) else len(lines))
          for k, (n, i) in enumerate(order)}

def items(sec):
    if sec not in bounds: return set()
    a, b = bounds[sec]
    return {m.group(1) for l in lines[a:b] if (m := re.match(r'^\s{0,3}([0-9]+)\.\s', l))}

five = set(re.findall(r'^\*\*5\.([0-9]+) —', s, re.M))
ten, six, three, eight = items('10'), items('6'), items('3'), items('8')
one4 = set()
if '1' in bounds:
    a, b = bounds['1']; inside = False
    for l in lines[a:b]:
        if re.match(r'^### 1\.4 ', l): inside = True; continue
        if inside and re.match(r'^### ', l): inside = False
        if inside and (m := re.match(r'^\s{0,3}([0-9]+)\.\s', l)): one4.add(m.group(1))

def resolves(ref):
    if ref in headings: return True
    if '.' not in ref: return ref in bounds
    top, sub = ref.split('.', 1); sub = sub.rstrip('abcdefghij') or sub
    if top == '5':  return sub in five
    if top == '10': return sub in ten
    if top == '6':  return sub in six
    if top == '8':  return sub in eight
    if top == '3':  return sub in three or ref in headings
    if top == '1':
        p = ref.split('.')
        if len(p) == 3 and p[1] == '4': return p[2] in one4
        return ref in headings
    return False

refs = sorted(set(re.findall(r'§([0-9]+(?:\.[0-9]+){0,2}[a-z]?)', s)))
bad = [(r, s.count('§' + r)) for r in refs if not resolves(r)]
print(f"  refs {len(refs)} · §5 rows {len(five)} · §10 items {len(ten)} · "
      f"§6 items {len(six)} · §1.4 clauses {len(one4)}")
for r, n in bad:
    print(f"  DANGLING §{r} — cited {n}x")
sys.exit(1 if bad else 0)
