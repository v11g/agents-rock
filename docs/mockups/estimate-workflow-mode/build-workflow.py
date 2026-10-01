# Workflow page (client view) = estimate.src.html + data + the shared roll-up
import pathlib
S = pathlib.Path(__file__).parent
h = (S / 'estimate.src.html').read_text()
eng = (S / 'eng-data.js').read_text() + (S / 'final-data.js').read_text() + (S / 'cap-data.js').read_text()
h = h.replace('/*DATA*/', (S / 'score-data.js').read_text()).replace('/*ENG*/', eng).replace('/*ROLLUP*/', (S / 'rollup.js').read_text())
assert '/*' + 'ENG*/' not in h
h = h.replace('</style>', (S / 'reading.css').read_text() + '</style>', 1)
(S / 'estimate-mockup.html').write_text(h)
print('ok', len(h))
