# Proposal mockup = the estimate's colour tokens + proposal body + reading style,
# filled from the same data and roll-up as the estimate pages
import pathlib
S = pathlib.Path(__file__).parent
est = (S / 'estimate.src.html').read_text()
head = est[:est.index('* { box-sizing:border-box; }')].replace('<title>Sin Kowa — estimate</title>', '<title>Sin Kowa — proposal</title>')
body = (S / 'proposal.body.html').read_text()
body = body.replace('</style>', (S / 'reading.css').read_text() + '</style>', 1)
eng = (S / 'eng-data.js').read_text() + (S / 'final-data.js').read_text() + (S / 'cap-data.js').read_text()
h = head + body
h = h.replace('/*DATA*/', (S / 'score-data.js').read_text()).replace('/*ENG*/', eng).replace('/*ROLLUP*/', (S / 'rollup.js').read_text())
assert '/*' + 'ROLLUP*/' not in h
(S / 'proposal-mockup.html').write_text(h)
print('ok', len(h))
