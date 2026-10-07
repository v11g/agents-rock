# Builds assets/estimator-system.xlsx, the workflow-mode workbook template:
# Estimator_v2 (the XLSX_TEMPLATE embedded in shared/assets/xlsx-export.js)
# with a SYSTEM / MODULE column inserted before the Ballpark tab's FEATURE
# column. LibreOffice does the insert, so every formula, merge, validation and
# the Roll-up's links into the Ballpark tab shift with it.
#
# Build time only, never at render. Needs LibreOffice (`soffice`) and the
# system Python that ships its `uno` module:
#   /usr/bin/python3 build-xlsx-template.py [--out <file>]
import base64
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path
from typing import Any
import uno
from com.sun.star.beans import PropertyValue

HERE = Path(__file__).resolve().parent
EXPORT_JS = HERE / '../../shared/assets/xlsx-export.js'
OUT = HERE / '../assets/estimator-system.xlsx'
CONTENTS = 1 | 2 | 4 | 16  # CellFlags VALUE | DATETIME | STRING | FORMULA: keeps the style
SPANNED_ROWS = (1, 2, 39)  # title, subtitle, note: text in A, merged A:N
BALLPARK_XML = 'xl/worksheets/sheet2.xml'
# Both A and B stay in view while scrolling right. A hidden document's view
# ignores freezeAtPosition, so the pane is set in the saved sheet instead.
PANE = ('<pane xSplit="1" ySplit="6" topLeftCell="B7"', '<pane xSplit="2" ySplit="6" topLeftCell="C7"')


def prop(name: str, value: Any) -> PropertyValue:
    p = PropertyValue()
    p.Name, p.Value = name, value
    return p


def connect(pipe: str) -> Any:
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
    for _ in range(120):
        try:
            return resolver.resolve(f'uno:pipe,name={pipe};urp;StarOffice.ComponentContext')
        except Exception:
            time.sleep(0.5)
    raise RuntimeError('LibreOffice did not start')


def copy_cells(sh: Any, src: str, dest: str) -> None:
    sh.copyRange(sh.getCellRangeByName(dest).CellAddress, sh.getCellRangeByName(src).RangeAddress)


def span_from_a(sh: Any, r: int) -> None:
    sh.getCellRangeByName(f'B{r}:N{r}').merge(False)
    copy_cells(sh, f'B{r}', f'A{r}')
    sh.getCellRangeByName(f'B{r}').clearContents(CONTENTS)
    sh.getCellRangeByName(f'A{r}:N{r}').merge(True)


def add_system_column(doc: Any) -> None:
    sh = doc.Sheets.getByName('Ballpark Estimator')
    sh.Columns.insertByIndex(0, 1)
    for r in SPANNED_ROWS:
        span_from_a(sh, r)
    copy_cells(sh, 'B6:B37', 'A6')  # header, feature cells and subtotal band: B's look
    sh.getCellRangeByName('A7:A37').clearContents(CONTENTS)
    sh.getCellRangeByName('A6').setString('SYSTEM / MODULE')
    cols = sh.Columns
    cols.getByIndex(0).Width = round(cols.getByIndex(1).Width * 24 / 30)


def freeze_two_columns(path: Path) -> None:
    with zipfile.ZipFile(path) as z:
        parts = [(i, z.read(i)) for i in z.infolist()]
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for info, data in parts:
            if info.filename == BALLPARK_XML:
                xml = data.decode('utf8')
                if PANE[0] not in xml:
                    raise RuntimeError('Ballpark pane not where expected')
                data = xml.replace(PANE[0], PANE[1]).encode('utf8')
            z.writestr(info, data)


def convert(src: Path, out: Path) -> None:
    pipe = f'xlsx-template-{os.getpid()}'
    profile = tempfile.mkdtemp(prefix='lo-xlsx-template-')
    office = subprocess.Popen(['soffice', '--headless', '--invisible', '--norestore',
                               f'-env:UserInstallation=file://{profile}', f'--accept=pipe,name={pipe};urp;'])
    try:
        desk = connect(pipe).ServiceManager.createInstance('com.sun.star.frame.Desktop')
        doc = desk.loadComponentFromURL(uno.systemPathToFileUrl(str(src)), '_blank', 0, (prop('Hidden', True),))
        add_system_column(doc)
        doc.storeToURL(uno.systemPathToFileUrl(str(out)), (prop('FilterName', 'Calc MS Excel 2007 XML'),))
        doc.close(True)
        try:
            desk.terminate()
        except Exception:
            pass  # the bridge drops as the office exits
        office.wait(timeout=60)
    finally:
        if office.poll() is None:
            office.kill()
        shutil.rmtree(profile, ignore_errors=True)


USAGE = 'usage: /usr/bin/python3 build-xlsx-template.py [--out <file>]'


def out_path() -> Path:
    if '--out' not in sys.argv:
        return OUT.resolve()
    at = sys.argv.index('--out') + 1
    if at >= len(sys.argv) or sys.argv[at].startswith('--'):
        sys.exit(USAGE)
    return Path(sys.argv[at]).resolve()


def template_b64() -> str:
    m = re.search(r"const XLSX_TEMPLATE = '([^']+)'", EXPORT_JS.read_text())
    if not m:
        raise RuntimeError(f'XLSX_TEMPLATE not found in {EXPORT_JS}')
    return m.group(1)


def main() -> None:
    out = out_path()
    b64 = template_b64()
    work = tempfile.mkdtemp(prefix='xlsx-template-')
    try:
        src = Path(work) / 'Estimator_v2.xlsx'
        src.write_bytes(base64.b64decode(b64))
        convert(src, out)
        freeze_two_columns(out)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print(out)


if __name__ == '__main__':
    main()
