/**
 * Extracts all Hope skins (infusion UUIDs) from a Monumenta resource pack
 * into a static data JSON file consumed by MonumentaAddons (/git hope).
 *
 * Usage:
 *   npx tsx scripts/extract-hopes.ts <resourcePackUrlOrZipPath> [outputFile]
 *
 * Defaults output to ../hopes/hopes.v1.json (relative to this script).
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

interface ZipEntry {
  filename: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const HOPE_INFUSER_KEY = "nbt.Monumenta.PlayerModified.Infusions.Hope.Infuser";
const DISPLAY_NAME_KEY = "nbt.plain.display.Name";

function parseZip(buffer: Buffer): Map<string, Buffer> {
  // Locate End Of Central Directory record
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Not a zip archive (EOCD not found)");

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);

  const entries = new Map<string, Buffer>();
  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const filename = buffer.slice(offset + 46, offset + 46 + nameLength).toString("utf8");
    offset += 46 + nameLength + extraLength + commentLength;

    if (filename.endsWith("/")) continue;

    // Parse local file header to find actual data start
    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const rawData = buffer.slice(dataStart, dataStart + compressedSize);

    entries.set(
      filename,
      method === 0 ? rawData : zlib.inflateRawSync(rawData),
    );
  }
  return entries;
}

function parseProperties(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return result;
}

/** "Covenmourn Rend" -> "covenmourn_rend" */
function itemSlug(itemName: string): string {
  return itemName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** "pepper1boy_covenmourn_rend" - "covenmourn_rend" -> "Pepper1boy" */
function skinNameFromFolder(folder: string, slug: string): string {
  let name = folder.toLowerCase().endsWith(`_${slug}`)
    ? folder.slice(0, folder.length - slug.length - 1)
    : folder;
  return name
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface HopeSkin {
  uuid: string;
  name: string;
}

function extractHopes(files: Map<string, Buffer>): Record<string, HopeSkin[]> {
  const citRoot = "assets/minecraft/optifine/cit/";
  const byItem = new Map<string, Map<string, { uuid: string; canonicalProps: Record<string, string> | null }>>();

  for (const [filename, data] of files) {
    if (!filename.startsWith(citRoot) || !filename.endsWith(".properties")) continue;

    const props = parseProperties(data.toString("utf8"));
    const uuid = props[HOPE_INFUSER_KEY];
    const itemName = props[DISPLAY_NAME_KEY];
    if (!uuid || !itemName) continue;

    const dir = path.posix.dirname(filename.slice(citRoot.length));
    const basename = path.posix.basename(filename, ".properties");

    let itemEntry = byItem.get(itemName);
    if (!itemEntry) {
      itemEntry = new Map();
      byItem.set(itemName, itemEntry);
    }

    const existing = itemEntry.get(dir);
    // The main .properties of a skin folder is named like its folder
    const isCanonical = basename === path.posix.basename(dir);
    if (!existing || isCanonical) {
      itemEntry.set(dir, { uuid, canonicalProps: isCanonical ? props : (existing?.canonicalProps ?? props) });
    }
  }

  const result: Record<string, HopeSkin[]> = {};
  for (const [itemName, skins] of [...byItem.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const slug = itemSlug(itemName);
    result[itemName] = [...skins.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dir, info]) => ({
        uuid: info.uuid,
        name: skinNameFromFolder(path.posix.basename(dir), slug),
        itemType: info.canonicalProps?.matchItems
          ?.split(/[,\s]+/)
          .filter(Boolean)[0] || undefined,
      }));
  }
  return result;
}

async function downloadToFile(url: string, target: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
}

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: npx tsx scripts/extract-hopes.ts <resourcePackUrlOrZipPath> [outputFile]");
    process.exit(1);
  }

  const outputFile = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.resolve(import.meta.dirname, "..", "hopes", "hopes.v1.json");

  let zipBuffer: Buffer;
  if (fs.existsSync(input)) {
    zipBuffer = fs.readFileSync(input);
  } else if (/^https?:\/\//.test(input)) {
    const tmpZip = "/tmp/opencode/hopes-pack.zip";
    console.log(`Downloading ${input} ...`);
    fs.mkdirSync(path.dirname(tmpZip), { recursive: true });
    await downloadToFile(input, tmpZip);
    zipBuffer = fs.readFileSync(tmpZip);
  } else {
    throw new Error(`Input not found: ${input}`);
  }

  console.log("Parsing resource pack...");
  const files = parseZip(zipBuffer);
  console.log(`Read ${files.size} files from pack`);

  const hopes = extractHopes(files);
  const totalSkins = Object.values(hopes).reduce((sum, list) => sum + list.length, 0);

  const output = {
    schemaVersion: 1,
    hopes,
  };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${totalSkins} hope skins across ${Object.keys(hopes).length} items to ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
