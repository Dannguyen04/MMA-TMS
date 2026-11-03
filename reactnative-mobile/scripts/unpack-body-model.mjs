// Create the native GLB without a runtime WebAssembly decoder. No mesh edits.
// Run: node scripts/unpack-body-model.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const sourcePath = new URL('../assets/models/muscular-v6e-meshopt.glb', import.meta.url);
const nativePath = new URL('../assets/models/muscular-v6e-native.glb', import.meta.url);
const extension = 'EXT_meshopt_compression';
const align = n => (n + 3) & ~3;
function parse(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const binStart = 20 + jsonLength;
  assert.equal(bytes.readUInt32LE(binStart + 4), 0x004e4942);
  return { json, bin: bytes.subarray(binStart + 8) };
}
function encode(json, bin) {
  const text = Buffer.from(JSON.stringify(json));
  const jsonBytes = Buffer.alloc(align(text.length), 32);
  text.copy(jsonBytes);
  const out = Buffer.alloc(28 + jsonBytes.length + align(bin.length));
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonBytes.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jsonBytes.copy(out, 20);
  out.writeUInt32LE(align(bin.length), 20 + jsonBytes.length); out.writeUInt32LE(0x004e4942, 24 + jsonBytes.length);
  bin.copy(out, 28 + jsonBytes.length);
  return out;
}
const sourceBytes = await readFile(sourcePath);
const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
const source = parse(sourceBytes);
const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
await MeshoptDecoder.ready;
const decoded = source.json.bufferViews.map(view => {
  const ext = view.extensions?.[extension];
  if (!ext) {
    assert.equal(view.buffer, 0, 'External buffers are not supported by this asset helper');
    return source.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  }
  assert.equal(ext.buffer, 0);
  const bytes = Buffer.alloc(ext.count * ext.byteStride);
  MeshoptDecoder.decodeGltfBuffer(bytes, ext.count, ext.byteStride,
    source.bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength), ext.mode, ext.filter);
  assert.equal(bytes.length, view.byteLength);
  return bytes;
});
if (!process.argv.includes('--check')) {
  const json = structuredClone(source.json);
  let offset = 0;
  const parts = [];
  json.bufferViews.forEach((view, i) => {
    const bytes = decoded[i];
    view.buffer = 0; view.byteOffset = offset; view.byteLength = bytes.length;
    if (view.extensions) {
      delete view.extensions[extension];
      if (!Object.keys(view.extensions).length) delete view.extensions;
    }
    parts.push(bytes, Buffer.alloc(align(bytes.length) - bytes.length));
    offset += align(bytes.length);
  });
  json.buffers = [{ byteLength: offset }];
  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    json[key] = (json[key] ?? []).filter(name => name !== extension);
    if (!json[key].length) delete json[key];
  }
  json.asset.extras = { ...json.asset.extras, nativeSourceSha256: sourceHash };
  await writeFile(nativePath, encode(json, Buffer.concat(parts)));
}
const nativeBytes = await readFile(nativePath);
const native = parse(nativeBytes);
assert.equal(native.json.asset.extras.nativeSourceSha256, sourceHash, 'Native asset must be regenerated');
assert(!native.json.extensionsRequired?.includes(extension));
assert.equal(native.json.bufferViews.length, decoded.length);
for (const key of ['accessors', 'meshes', 'nodes', 'scenes', 'materials']) assert.deepEqual(native.json[key], source.json[key], `${key} changed`);
native.json.bufferViews.forEach((view, i) => {
  assert.equal(view.buffer, 0);
  assert(!view.extensions?.[extension]);
  assert.deepEqual(native.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength), decoded[i], `Decoded buffer ${i} changed`);
});
// Verify actual loader operation without registering a Meshopt decoder.
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const gltf = await new GLTFLoader().parseAsync(nativeBytes.buffer.slice(nativeBytes.byteOffset, nativeBytes.byteOffset + nativeBytes.byteLength), '');
let vertices = 0, triangles = 0;
gltf.scene.traverse(mesh => {
  if (!mesh.isMesh) return;
  vertices += mesh.geometry.attributes.position.count;
  triangles += mesh.geometry.index.count / 3;
  for (let i = 0; i < 4; i++) assert(mesh.geometry.attributes[`_geo${i}`], `Missing paint channel ${i}`);
});
console.log(JSON.stringify({ sourceHash, sourceBytes: sourceBytes.length, nativeBytes: nativeBytes.length,
  vertices, triangles, decodedBuffersIdentical: decoded.length, loaderWithoutMeshopt: true }));
