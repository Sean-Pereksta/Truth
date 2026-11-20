/* The base ZIP carries the Windows runtime and original models. The checked
 * overlay supplies the earlier PC release; current files replace its entries. */
(() => {
  'use strict';
  const overlayHeader = 28;
  const localHeader = 0x04034b50, directoryHeader = 0x02014b50, endHeader = 0x06054b50;
  const linkSelector = 'a[href="?download=pc"]';
  const utf8 = new TextEncoder(), decode = new TextDecoder();
  const fontFiles = ['display', 'heading', 'sans'].map(name => `fonts/rally-${name}.ttf`);
  // Changes since the binary overlay was last rebuilt. The base still supplies
  // the launcher, compressed model pack, and unchanged assets.
  const releaseFiles = [
    'index.html', 'style.css', 'rooms.css', 'app.js', 'network.js', 'local-grid.js', 'data.js', 'championship.js', 'garage-view.js',
    'kart-rig.js', 'aurora-kart.js', 'angel-kart.js', 'signature-kit.js', 'signature-art.js',
    'tracks-expansion.js', 'expansion-world.js', 'minecart-hazards.js', 'hazards.js', 'bullfrog-art.js', 'cosmic-hazards-art.js', 'course-art.js', 'rally-course-scores.js',
    'breakwater-tides.js', 'race-sim.js', 'race-world.js', 'race.js', 'item-art.js', 'item-feedback.js',
    'mythic-world.js', 'mythic-hazards-art.js', 'ramps.js', 'ramp-art.js', 'cup-menu.css', 'horizon.js',
    'darkness-world.js', 'darkness-hazards-art.js', 'grimoire-kart.js', 'touch-controls.js', 'touch-controls.css',
    'server/host.cjs', 'server/Hosting.txt', 'server/lobby-supervisor.cjs', 'server/Start Acorn Rally Lobby.cmd', 'server/firebase-lobby.cjs',
    'art/driver-9.webp', 'art/rear-9.webp', 'art/rear-mask-9.png',
    'art/driver-10.webp', 'art/rear-10.webp', 'art/rear-mask-10.png',
    'art/driver-11.webp', 'art/rear-11.webp', 'art/rear-mask-11.png',
    ...[16, 17, 18, 19, 20].map(id => `art/road-${id}.webp`),
    ...[13, 14, 15, 16, 17, 18, 19, 20].flatMap(id => [`art/course-${id}.webp`, `art/horizon-${id}.webp`]),
    ...fontFiles
  ];
  const crcTable = Uint32Array.from({length: 256}, (_, i) => {
    for (let bit = 0; bit < 8; bit++) i = (i >>> 1) ^ ((i & 1) ? 0xedb88320 : 0);
    return i;
  });
  let busy = false;

  async function resource(path){
    const response = await fetch(path, {cache: 'no-cache'});
    if (!response.ok) throw new Error('Missing download resource ' + path);
    return response.blob();
  }
  function crc(bytes){
    let value = 0xffffffff;
    for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255];
    return (value ^ 0xffffffff) >>> 0;
  }
  async function legacyEdition(base, overlay){
    const head = new DataView(await overlay.slice(0, overlayHeader).arrayBuffer());
    const field = offset => head.getUint32(offset, true);
    const cut = field(12), addition = overlay.slice(overlayHeader);
    if (decode.decode(head.buffer.slice(0, 8)) !== 'ACORNZIP' || base.size !== field(8) ||
        cut >= base.size || addition.size !== field(20) ||
        crc(new Uint8Array(await base.slice(cut).arrayBuffer())) !== field(16) ||
        crc(new Uint8Array(await addition.arrayBuffer())) !== field(24)){
      throw new Error('Mismatched download resources');
    }
    return new Blob([base.slice(0, cut), addition]);
  }
  async function zipDirectory(zip){
    // The EOCD is 22 bytes plus up to 65,535 bytes of ZIP comment.
    const tailStart = Math.max(0, zip.size - 65557);
    const tail = new DataView(await zip.slice(tailStart).arrayBuffer());
    for (let pos = tail.byteLength - 22; pos >= 0; pos--){
      if (tail.getUint32(pos, true) !== endHeader || pos + 22 + tail.getUint16(pos + 20, true) !== tail.byteLength) continue;
      const count = tail.getUint16(pos + 10, true);
      const size = tail.getUint32(pos + 12, true), offset = tail.getUint32(pos + 16, true);
      if (tail.getUint32(pos + 4, true) !== 0 || tail.getUint16(pos + 8, true) !== count ||
          offset + size !== tailStart + pos) break;
      const bytes = new Uint8Array(await zip.slice(offset, offset + size).arrayBuffer());
      const view = new DataView(bytes.buffer), entries = new Map();
      let entry = 0;
      while (entry + 46 <= size && view.getUint32(entry, true) === directoryHeader){
        const nameEnd = entry + 46 + view.getUint16(entry + 28, true);
        const end = nameEnd + view.getUint16(entry + 30, true) + view.getUint16(entry + 32, true);
        if (end > size) break;
        const name = decode.decode(bytes.subarray(entry + 46, nameEnd));
        entries.set(name, bytes.subarray(entry, end));
        entry = end;
      }
      if (entry === size && entries.size === count) return {offset, entries};
      break;
    }
    throw new Error('Invalid PC archive directory');
  }
  function zipEntry(name, bytes, offset){
    const filename = utf8.encode(name);
    const local = new Uint8Array(30 + filename.length), directory = new Uint8Array(46 + filename.length);
    const file = new DataView(local.buffer), entry = new DataView(directory.buffer);
    const checksum = crc(bytes);
    function writeMetadata(view, start){
      view.setUint16(start, 20, true);     // ZIP version 2.0
      view.setUint16(start + 2, 0x800, true); // UTF-8 name, stored data
      view.setUint16(start + 8, 0x21, true);  // 1980-01-01, midnight
      view.setUint32(start + 10, checksum, true);
      view.setUint32(start + 14, bytes.byteLength, true);
      view.setUint32(start + 18, bytes.byteLength, true);
      view.setUint16(start + 22, filename.length, true);
    }
    file.setUint32(0, localHeader, true);
    writeMetadata(file, 4);
    local.set(filename, 30);
    entry.setUint32(0, directoryHeader, true);
    entry.setUint16(4, 20, true);
    writeMetadata(entry, 6);
    entry.setUint32(42, offset, true);
    directory.set(filename, 46);
    return {local, directory};
  }
  async function assembleEdition(base, overlay, updates){
    const zip = await legacyEdition(base, overlay);
    const {offset, entries} = await zipDirectory(zip);
    const parts = [zip.slice(0, offset)];
    let nextOffset = offset;
    for (const [name, bytes] of updates){
      const {local, directory} = zipEntry(name, bytes, nextOffset);
      parts.push(local, bytes);
      entries.set(name, directory);
      nextOffset += local.length + bytes.length;
    }
    const directory = new Blob([...entries.values()]);
    if (entries.size >= 0xffff || nextOffset + directory.size >= 0xffffffff) throw new Error('PC archive is too large');
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, endHeader, true);
    end.setUint16(8, entries.size, true);
    end.setUint16(10, entries.size, true);
    end.setUint32(12, directory.size, true);
    end.setUint32(16, nextOffset, true);
    return new Blob([...parts, directory, end.buffer], {type: 'application/zip'});
  }
  function dataUrl(type, bytes){
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 16384) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 16384)));
    return 'data:' + type + ';base64,' + btoa(chunks.join(''));
  }
  async function releaseContent(fetchFile = resource){
    const files = new Map(await Promise.all(releaseFiles.map(async name => {
      const body = await fetchFile(name);
      if (!body.size) throw new Error('Empty download resource ' + name);
      return [name, new Uint8Array(await body.arrayBuffer())];
    })));
    const put = (name, source) => files.set(name, utf8.encode(source));
    const edit = (name, transform) => put(name, transform(decode.decode(files.get(name))));
    const pcLink = /<a\b[^>]*href="\?download=pc"[^>]*>.*?<\/a>/g;
    edit('index.html', source => source
      .replace(/(?:<span><\/span>)?<a\b[^>]*href="\?download=pc"[^>]*>.*?<\/a>/g, '')
      .replace(/\s*<script src="pc-download\.js(?:\?[^"\s]*)?"><\/script>/, '')
      .replace(/<link\b[^>]*as="font"[^>]*>\s*/, '')
      .replace('<script src="data.js">', `<script>if(location.protocol==='file:')for(const file of ['file-textures.js','file-textures-update.js','file-textures-current.js'])document.write('<script src="'+file+'"><\\/script>');</script>\n  <script src="data.js">`));
    edit('app.js', source => source.replace(/<p class="form-note"><a\b[^>]*href="assets\/Acorn-Rally-Models\.zip"[^>]*>.*?<\/a><\/p>/g, ''));
    edit('network.js', source => source.replace(pcLink, '')
      .replace('Download the PC edition and run <b>Start Acorn Rally</b>.', 'Open <b>Start Acorn Rally.cmd</b> from the extracted game folder.'));
    edit('race.js', source => source.replace('i.src=src;fallbackImages[src]=i', 'i.src=window.AcornFileTextures?.[src] || src;fallbackImages[src]=i'));
    edit('horizon.js', source => source.replace("image.src='art/horizon-'+i+'.webp'",
      "image.src=window.AcornFileTextures?.['art/horizon-'+i+'.webp'] || 'art/horizon-'+i+'.webp'"));
    edit('style.css', source => fontFiles.reduce((css, name) =>
      css.replace(`url(${name})`, `url(${dataUrl('font/ttf', files.get(name))})`), source));
    const textures = Object.fromEntries([...files]
      .filter(([name]) => /^art\/(horizon|road|rear)-/.test(name))
      .map(([name, bytes]) => [name, dataUrl('image/' + name.split('.').pop(), bytes)]));
    put('file-textures-current.js', 'Object.assign(window.AcornFileTextures,' + JSON.stringify(textures) + ');\n');
    put('Read Me.txt', [
      'ACORN RALLY - PC EDITION', '',
      'Extract the ZIP and double-click "Start Acorn Rally.cmd" on Windows to start the included PC host.',
      'For solo or local play, you can also open index.html directly.', '',
      'Choose from five cups. Win the original three cups on Hard or Ultimate to unlock Solstice.',
      'Finish first on all twenty cup circuits against Ultimate rivals to unlock Aurel and the Sunward Chariot.',
      'Win the standalone Realm of Darkness on Ultimate to unlock Grimoire the Vile and the Blackletter Hearse.',
      'Win the Spectrum Cup on Ultimate to unlock the Aurora Runner. Settings, records and cups save in your browser.', '',
      'For one always-on room, open server/Start Acorn Rally Lobby.cmd on Windows.',
      'On macOS or Linux, use node server/lobby-supervisor.cjs with Node.js 18 or newer.',
      'See server/Hosting.txt for additional hosting instructions.', ''
    ].join('\r\n'));
    return files;
  }
  async function download(){
    if (busy) return;
    busy = true;
    notice('Preparing the Windows download…');
    try {
      const [base, overlay, updates] = await Promise.all([
        resource('assets/Acorn-Rally-PC.zip'), resource('assets/pc-expansion.bin'), releaseContent()
      ]);
      const url = URL.createObjectURL(await assembleEdition(base, overlay, updates));
      const a = document.createElement('a');
      a.href = url; a.download = 'Acorn-Rally-PC.zip'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      notice('PC edition ready. Extract the ZIP and open Start Acorn Rally.cmd.');
    } catch {
      notice('PC download interrupted. Check your connection and select PC edition to retry.');
    } finally {
      busy = false;
    }
  }
  if (typeof module === 'object' && module.exports){
    module.exports = {assembleEdition, releaseContent, releaseFiles};
    return;
  }
  document.addEventListener('click', event => {
    if (event.target.closest(linkSelector) && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey){
      event.preventDefault(); download();
    }
  });
  if (new URLSearchParams(location.search).get('download') === 'pc') download();
})();
