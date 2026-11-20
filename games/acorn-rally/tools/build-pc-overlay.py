"""Rebuild the PC download after changing game code or art. Uses Python 3.10+.

Run python tools/build-pc-overlay.py in the game directory. The hosted ZIP
provides the original licensed Windows runtime, launcher and compressed models.
Its bytes and filename must remain intact alongside the generated overlay.
The web downloader also layers the current release files from pc-download.js
onto this overlay so source updates can ship without rebuilding the binary.
"""
import base64
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
import tempfile
import zipfile
import zlib


GAME = Path(__file__).resolve().parents[1]
BASE = GAME / "assets/Acorn-Rally-PC.zip"
OVERLAY = GAME / "assets/pc-expansion.bin"
TEXT = {".html", ".js", ".css", ".cjs", ".txt", ".cmd"}


def data_url(path, mime):
    return "data:" + mime + ";base64," + base64.b64encode(path.read_bytes()).decode()


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError(f"Expected one occurrence of {before!r}")
    return text.replace(before, after)


def build_sources(base):
    paths = [p for p in GAME.iterdir() if p.is_file() and p.suffix in {".html", ".css", ".js", ".svg"}]
    for directory in ["server", "art", "fonts"]:
        paths.extend(p for p in (GAME / directory).rglob("*") if p.is_file())
    files = {p.relative_to(GAME).as_posix(): p.read_bytes() for p in paths if p.name != "pc-download.js"}
    files["Start Acorn Rally.cmd"] = base.read("Start Acorn Rally.cmd")
    files["Read Me.txt"] = (
        "ACORN RALLY — PC EDITION\r\n\r\n"
        'Extract this ZIP. On Windows, double-click "Start Acorn Rally.cmd" to open the game. '
        "The Windows x64 Node.js runtime and its license are included in runtime/.\r\n\r\n"
        "Open Cup series to choose a four-race cup, engine class and AI difficulty. "
        "Win the original three cups on Hard or Ultimate to unlock Solstice. "
        "Win the Spectrum Cup on Ultimate to unlock the Aurora Runner. Settings, records and cups save in this browser.\r\n\r\n"
        "For solo or local play you can also open index.html. On macOS or Linux, use "
        "Node.js 18 or newer and run node server/host.cjs for private rooms. "
        "Additional hosting and network instructions are in server/Hosting.txt.\r\n"
    ).encode()

    # Local-file origins cannot upload cross-origin images to a WebGL texture.
    # Reuse the base package's embedded texture data and add new/changed images.
    texture_script = base.read("file-textures.js")
    embedded = json.loads(texture_script.decode().split("window.AcornFileTextures=", 1)[1].strip().rstrip(";"))
    files["file-textures.js"] = texture_script
    additions = {}
    for name in sorted(files):
        if not (name == "art/trail-materials.webp" or name.startswith(("art/horizon-", "art/road-", "art/rear-"))):
            continue
        mime = "image/" + Path(name).suffix[1:]
        url = data_url(GAME / name, mime)
        if embedded.get(name) != url:
            additions[name] = url
    files["file-textures-update.js"] = ("Object.assign(window.AcornFileTextures," +
        json.dumps(additions, separators=(",", ":")) + ");\n").encode()

    def edit(name, before, after):
        files[name] = replace_once(files[name].decode(), before, after).encode()

    edit("surface-kit.js", "img.src='art/trail-materials.webp'",
         "img.src=window.AcornFileTextures?.['art/trail-materials.webp'] || 'art/trail-materials.webp'")
    edit("horizon.js", "image.src='art/horizon-'+i+'.webp'",
         "image.src=window.AcornFileTextures?.['art/horizon-'+i+'.webp'] || 'art/horizon-'+i+'.webp'")
    edit("race.js", "i.src=src;fallbackImages[src]=i", "i.src=window.AcornFileTextures?.[src] || src;fallbackImages[src]=i")
    edit("index.html", '  <script src="pc-download.js"></script>', '')
    edit("index.html", '<script src="data.js">',
         """<script>if(location.protocol==='file:')for(const file of ['file-textures.js','file-textures-update.js'])document.write('<script src="'+file+'"><\\/script>');</script>
  <script src="data.js">""")
    def strip_link(name, pattern):
        text, count = re.subn(pattern, '', files[name].decode())
        if count != 1:
            raise ValueError("Could not remove download link in " + name)
        files[name] = text.encode()
    strip_link("index.html", r'(?:<span></span>)?<a\b[^>]*href="\?download=pc"[^>]*>.*?</a>')
    strip_link("network.js", r'<a\b[^>]*href="\?download=pc"[^>]*>.*?</a>')
    edit("network.js", "Download the PC edition and run <b>Start Acorn Rally</b>.",
         "Open <b>Start Acorn Rally.cmd</b> from the extracted game folder.")
    strip_link("app.js", r'<p class="form-note"><a\b[^>]*href="assets/Acorn-Rally-Models\.zip"[^>]*>.*?</a></p>')
    html = re.sub(r'<link\b[^>]*as="font"[^>]*>\s*', '', files["index.html"].decode())
    files["index.html"] = html.encode()
    style = files["style.css"].decode()
    for path in sorted((GAME/"fonts").glob("*.ttf")):
        name = path.relative_to(GAME).as_posix()
        style = style.replace("url("+name+")", "url("+data_url(path, "font/ttf")+")")
    files["style.css"] = style.encode()
    return files


def normalized(data, name):
    return data.replace(b"\r\n", b"\n") if Path(name).suffix in TEXT else data


def main():
    with zipfile.ZipFile(BASE) as base:
        files = build_sources(base)
        original = {entry.filename: entry for entry in base.infolist()}
        cut = base.start_dir
        # Preserve the binary runtime and its license literally from the base.
        retained = {name for name in original if name.startswith("runtime/")}
        changed = {}
        for name, data in sorted(files.items()):
            if not data:
                raise ValueError("Empty release asset: " + name)
            if name in original and normalized(base.read(name), name) == normalized(data, name):
                retained.add(name)
            else:
                changed[name] = data
        if "race-models.js" in changed:
            print("Model data changed; the overlay will include a new model pack.")
        with tempfile.TemporaryFile() as full:
            with BASE.open("rb") as source:
                shutil.copyfileobj(source, full)
                source.seek(cut)
                directory = source.read()
            with zipfile.ZipFile(full, "a", compression=zipfile.ZIP_DEFLATED) as output:
                output.filelist = [entry for entry in output.filelist if entry.filename in retained]
                output.NameToInfo = {entry.filename: entry for entry in output.filelist}
                for name, data in changed.items():
                    entry = zipfile.ZipInfo(name, date_time=(1980,1,1,0,0,0))
                    output.writestr(entry, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            # Verify CRCs and the exact set of entries delivered to an extractor.
            with zipfile.ZipFile(full) as check:
                expected = retained | changed.keys()
                assert check.testzip() is None and len(check.namelist()) == len(expected)
                assert set(check.namelist()) == expected
                for name, data in files.items():
                    assert normalized(check.read(name), name) == normalized(data, name), name
                for name in ["runtime/node.exe", "runtime/Node-LICENSE.txt", "Start Acorn Rally.cmd"]:
                    assert check.read(name) == base.read(name)
                for name in re.findall(r'<script src="([\w.-]+)"', check.read("index.html").decode()):
                    assert name in expected, name
            full.seek(cut)
            tail = full.read()
    header = struct.pack("<8sIIIII", b"ACORNZIP", BASE.stat().st_size, cut, zlib.crc32(directory), len(tail), zlib.crc32(tail))
    payload = header + tail
    staging = OVERLAY.with_suffix(".tmp")
    staging.write_bytes(payload)
    staging.replace(OVERLAY)
    print(f"{len(changed)} updated entries, {len(retained)} reused. Overlay {len(payload):,} bytes. "
          f"Complete ZIP {cut+len(tail):,} bytes. SHA-256 of overlay {hashlib.sha256(payload).hexdigest()}")


if __name__ == "__main__":
    main()
