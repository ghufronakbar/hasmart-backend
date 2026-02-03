// scripts/seed-item.ts
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface ItemSeed {
  kodeItem: string;
  namaItem: string;
  kodeJenis: string;
  kodePemasok: string;

  hargaBeli: number | null;
  hargaPokok: number | null;

  satuan1: string;
  satuan2?: string | null;

  kuantitas1: number | null;
  kuantitas2?: number | null;

  hargaJualEcer1: number | null;
  hargaJualEcer2?: number | null;

  hargaJualGrosir1: number | null;
  hargaJualGrosir2?: number | null;

  hargaJualKhusus1: number | null;
  hargaJualKhusus2?: number | null;

  stok: number | null;
  upload: string;
  tipe: string;
}

// Kolom excel -> field interface
const COL_MAP: Record<string, keyof ItemSeed> = {
  KodeItem: "kodeItem",
  NamaItem: "namaItem",
  KodeJenis: "kodeJenis",
  KodePemasok: "kodePemasok",
  HargaBeli: "hargaBeli",
  HargaPokok: "hargaPokok",
  Satuan1: "satuan1",
  Satuan2: "satuan2",
  Kuantitas1: "kuantitas1",
  Kuantitas2: "kuantitas2",
  HargaJualEcer1: "hargaJualEcer1",
  HargaJualEcer2: "hargaJualEcer2",
  HargaJualGrosir1: "hargaJualGrosir1",
  HargaJualGrosir2: "hargaJualGrosir2",
  HargaJualKhusus1: "hargaJualKhusus1",
  HargaJualKhusus2: "hargaJualKhusus2",
  Stok: "stok",
  Upload: "upload",
  Tipe: "tipe",
};

const NUM_FIELDS = new Set<keyof ItemSeed>([
  "hargaBeli",
  "hargaPokok",
  "kuantitas1",
  "kuantitas2",
  "hargaJualEcer1",
  "hargaJualEcer2",
  "hargaJualGrosir1",
  "hargaJualGrosir2",
  "hargaJualKhusus1",
  "hargaJualKhusus2",
  "stok",
]);

function toText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Parse angka dari format:
 * - "1,384.92" (comma thousand, dot decimal)
 * - "1.384,92" (dot thousand, comma decimal)
 * - "10.00", "10", "0.00"
 * - "" => null
 */
function parseNumberSmart(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  let s = String(v).trim();
  if (s === "") return null;

  // Hapus spasi
  s = s.replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Tentukan mana decimal separator dari posisi terakhir
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");

    if (lastDot > lastComma) {
      // "1,384.92" => remove commas
      s = s.replace(/,/g, "");
    } else {
      // "1.384,92" => remove dots then comma->dot
      s = s.replace(/\./g, "").replace(/,/g, ".");
    }
  } else if (hasComma && !hasDot) {
    // Bisa "1,234" (thousand) atau "12,5" (decimal)
    if (/^\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(/,/g, ".");
    }
  } else if (!hasComma && hasDot) {
    // Bisa "1.234" (thousand) atau "12.5" (decimal)
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function readXlsAsItems(filePath: string): ItemSeed[] {
  // raw:false => ambil nilai "formatted text" (lebih aman untuk KodeItem panjang)
  const wb = XLSX.readFile(filePath, { raw: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Excel tidak punya sheet.");

  const ws = wb.Sheets[sheetName];
  // header:1 => array-of-arrays, supaya kita kontrol mapping + string safety
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  if (rows.length < 2) return [];

  const headers = (rows[0] as unknown[]).map((h) => toText(h));
  const items: ItemSeed[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!row || row.length === 0) continue;

    const obj: Partial<ItemSeed> = {};

    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      const key = COL_MAP[h];
      if (!key) continue;

      const cell = row[c];

      if (NUM_FIELDS.has(key)) {
        (obj as any)[key] = parseNumberSmart(cell);
      } else {
        (obj as any)[key] = toText(cell);
      }
    }

    // Skip baris kosong
    const kodeItem = (obj.kodeItem ?? "").trim();
    const namaItem = (obj.namaItem ?? "").trim();
    if (!kodeItem && !namaItem) continue;

    // Normalisasi optional: Satuan2 bisa kosong => null
    const satuan2 = (obj.satuan2 ?? "").trim();
    obj.satuan2 = satuan2 === "" ? null : satuan2;

    // Pastikan required minimal ada (sesuaikan kebutuhanmu)
    if (!kodeItem) {
      throw new Error(`Row ${r + 1}: KodeItem kosong`);
    }
    if (!namaItem) {
      throw new Error(`Row ${r + 1}: NamaItem kosong (KodeItem=${kodeItem})`);
    }

    // Default untuk field string wajib kalau kosong
    obj.kodeJenis = (obj.kodeJenis ?? "").trim();
    obj.kodePemasok = (obj.kodePemasok ?? "").trim();
    obj.satuan1 = (obj.satuan1 ?? "").trim();
    obj.upload = (obj.upload ?? "").trim();
    obj.tipe = (obj.tipe ?? "").trim();

    items.push(obj as ItemSeed);
  }

  return items;
}

// ====== USAGE ======
const xlsPath = path.resolve(process.cwd(), "scripts", "DATAITEMBARANG.xls");

// Ini variable JSON yang kamu minta:
const seeds = async () => {
  const itemsJson: ItemSeed[] = readXlsAsItems(xlsPath);
  // Contoh cek output:
  //   console.log(`Loaded items: ${itemsJson.length}`);
  //   console.log(itemsJson[0]);

  const uniqueSupplier = new Set<string>();
  const uniqueUnit = new Set<string>();
  const uniqueCategory = new Set<string>();

  itemsJson.forEach((item) => {
    uniqueSupplier.add(item.kodePemasok);
    uniqueUnit.add(item.satuan1);
    if (item.satuan2) {
      uniqueUnit.add(item.satuan2);
    }
    uniqueCategory.add(item.kodeJenis);
  });

  await prisma.$transaction(async (tx) => {
    // create branch
    const branch = await tx.branch.create({
      data: {
        code: "UTAMA",
        name: "Hasmart Utama",
        address: "Jl Raya Sruwen-Karanggede KM.10 Susukan,Semarang",
        phone: "081229706622",
      },
    });

    const branchId = branch.id;

    // create supplier
    const suppliers = await Promise.all(
      Array.from(uniqueSupplier).map((code) => {
        const supplier = tx.masterSupplier.create({
          data: {
            code,
            name: code,
          },
        });
        console.log("Supplier created", supplier);
        return supplier;
      }),
    );

    // create unit
    const units = await Promise.all(
      Array.from(uniqueUnit).map((code) => {
        const unit = tx.masterUnit.create({
          data: {
            name: code,
            unit: code,
          },
        });
        console.log("Unit created", unit);
        return unit;
      }),
    );

    // create category
    const categories = await Promise.all(
      Array.from(uniqueCategory).map((code) => {
        const category = tx.masterItemCategory.create({
          data: {
            code,
            name: code,
          },
        });
        console.log("Category created", category);
        return category;
      }),
    );

    for await (const item of itemsJson) {
      const category = categories.find((c) => c.code === item.kodeJenis);
      if (!category) {
        console.log("Category not found", item.kodeJenis);
        continue;
      }
      const supplier = suppliers.find((s) => s.code === item.kodePemasok);
      if (!supplier) {
        console.log("Supplier not found", item.kodePemasok);
        continue;
      }
      const masterItemVariants = [
        {
          amount: item.kuantitas1 || 1,
          isBaseUnit: item.kuantitas1 === 1,
          recordedBuyPrice: 0,
          recordedProfitAmount: 0,
          recordedProfitPercentage: 0,
          sellPrice: item.hargaJualEcer1 || 0,
          unit: item.satuan1,
        },
      ];

      if (item.satuan2 && item.kuantitas2 && item.hargaJualEcer2) {
        masterItemVariants.push({
          amount: item.kuantitas2,
          isBaseUnit: false,
          recordedBuyPrice: 0,
          recordedProfitAmount: 0,
          recordedProfitPercentage: 0,
          sellPrice: item.hargaJualEcer2,
          unit: item.satuan2,
        });
      }

      const createdItem = await tx.masterItem.create({
        data: {
          code: item.kodeItem,
          isActive: true,
          name: item.namaItem,
          recordedBuyPrice: 0,
          masterItemCategoryId: category.id,
          masterSupplierId: supplier.id,
          masterItemVariants: {
            createMany: {
              data: masterItemVariants,
            },
          },
        },
        include: {
          _count: {
            select: {
              masterItemVariants: true,
            },
          },
        },
      });

      console.log(
        "Item created",
        createdItem.name,
        "total variant",
        createdItem._count.masterItemVariants,
      );
    }
  });
};

seeds().catch((err) => {
  console.error(err);
  process.exit(1);
});
