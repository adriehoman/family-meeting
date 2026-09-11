"""Build Family_Meeting.html / index.html from the source parts.
Usage: python3 build.py [PIN]      (PIN defaults to 2468; only used when the page runs on a website)"""
import hashlib, sys
pin = sys.argv[1] if len(sys.argv)>1 else '2468'
h = hashlib.sha256(pin.encode()).hexdigest()
t = open('template.html').read(); a = open('app.js').read().replace('__PIN_HASH__', h)
s = open('scenarios.js').read(); p = open('portraits.js').read()
html = t.replace('/*PORTRAITS*/', p).replace('/*SCENARIOS*/', s).replace('/*APP*/', a)
open('Family_Meeting.html','w').write(html); open('index.html','w').write(html)
print('built Family_Meeting.html and index.html (PIN', pin+')')
