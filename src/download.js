import { getHistoricalRates } from "dukascopy-node";
import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_INSTRUMENTS } from "./instruments.js";

const env = (k, d) => process.env[k]?.trim() || d;

const instruments = env("INSTRUMENTS", DEFAULT_INSTRUMENTS.join(","))
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const timeframe = env("TIMEFRAME", "tick"); // tick | s1 | m1 | m30 | h1 | d1
const format = env("FORMAT", "csv");        // csv | json | array
const priceType = env("PRICE_TYPE", "bid"); // bid | ask
const volumes = env("VOLUMES", "true") === "true";
const outDir = env("OUT_DIR", "data");

// بازه زمانی: اگر داده نشود، دیروز (UTC) دانلود می‌شود
function defaultRange() {
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 1);
  return { from, to };
}

const fromEnv = env("FROM");
const toEnv = env("TO");
const { from, to } = fromEnv && toEnv
  ? { from: new Date(fromEnv), to: new Date(toEnv) }
  : defaultRange();

const iso = (d) => d.toISOString().slice(0, 10);

async function run() {
  await fs.mkdir(outDir, { recursive: true });
  console.log(`بازه: ${iso(from)} → ${iso(to)} | تایم‌فریم: ${timeframe}`);

  for (const instrument of instruments) {
    try {
      console.log(`⬇️  دانلود ${instrument} ...`);
      const data = await getHistoricalRates({
        instrument,
        dates: { from, to },
        timeframe,
        priceType,
        volumes,
        format,
        utcOffset: 0,
        retryCount: 5,
        pauseBetweenRetriesMs: 2000,
        useCache: true,
        cacheFolderPath: ".dukascopy-cache",
        batchSize: 10,
        pauseBetweenBatchesMs: 500,
      });

      const ext = format === "csv" ? "csv" : "json";
      const file = path.join(
        outDir,
        `${instrument}_${timeframe}_${iso(from)}_${iso(to)}.${ext}`
      );
      const body = typeof data === "string" ? data : JSON.stringify(data);
      await fs.writeFile(file, body, "utf8");

      const bytes = Buffer.byteLength(body, "utf8");
      console.log(`✅ ${file} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
    } catch (err) {
      console.error(`❌ خطا در ${instrument}:`, err?.message || err);
      process.exitCode = 1;
    }
  }
}

run();
