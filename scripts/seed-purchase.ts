import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import axios from "axios";
import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";

dotenv.config();

const JWT_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  "s3cr3t-must-be-very-long-and-secure-min-32-chars"; // Fallback matching common env

const prisma = new PrismaClient();

const axiosInstance = axios.create({
  baseURL: "http://localhost:9999/api",
});

export interface PembelianDoc {
  meta?: {
    app?: string; // "HaSmart"
    report?: string; // "PEMBELIAN"
    address?: string;
    phone?: string;
  };
  pembelian: PembelianEntry[];
}

export interface PembelianEntry {
  header: PembelianHeader;
  items: PembelianItem[];
  summary?: PembelianSummary;
}

export interface PembelianHeader {
  nomor?: string; // "BL2601000002"
  admin?: string; // "Admin"
  tanggal?: string; // ISO: "2026-01-10" (hasil parse dd/mm/yyyy)
  pemasok?: string; // "INDOMARCO"
  jatuhTempo?: string; // ISO
  lokasi?: string; // "SALATIGA" (kalau ada)
}

export interface PembelianItem {
  no: number;
  kode: string;
  nama: string;
  kuantitas: number | null;
  sat: string;
  hargaBeli: number | null;
  diskon: number | null;
  discounts?: number | null;
  jumlah: number | null;
}

export interface PembelianSummary {
  keterangan?: string | null; // boleh kosong
  subTotal?: number | null;
  diskon?: number | null;
  total?: number | null;
}

function toText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Parse angka dari format:
 * - "107,000.00" (comma thousand, dot decimal)
 * - "1.384,92" (dot thousand, comma decimal)
 * - "" => null
 */
function parseNumberSmart(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  let s = String(v).trim();
  if (s === "") return null;

  s = s.replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastDot > lastComma) {
      // "107,000.00" => remove commas
      s = s.replace(/,/g, "");
    } else {
      // "1.384,92" => remove dots, comma->dot
      s = s.replace(/\./g, "").replace(/,/g, ".");
    }
  } else if (hasComma && !hasDot) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
    else s = s.replace(/,/g, ".");
  } else if (!hasComma && hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDateDDMMYYYY(v: unknown): string | undefined {
  const s = toText(v);
  if (!s) return undefined;

  // support "10/01/2026" or "10-01-2026"
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!m) return undefined;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return undefined;

  const iso = `${yyyy.toString().padStart(4, "0")}-${mm
    .toString()
    .padStart(2, "0")}-${dd.toString().padStart(2, "0")}`;
  return iso;
}

function isLikelyPurchaseHeaderRow(row: string[]): boolean {
  // Header transaksi biasanya punya pola: "Nomor", ":", "BL....", ... dan ada "No", "Kode", "Nama"
  const hasNomor = row.some((c) => c === "Nomor");
  const hasColon = row.includes(":");
  const hasTableHead =
    row.includes("No") && row.includes("Kode") && row.includes("Nama");
  return hasNomor && hasColon && hasTableHead;
}

function isItemRow(row: string[]): boolean {
  // Item row: kolom 0 = angka (No)
  const c0 = row[0] ?? "";
  return /^\d+$/.test(c0);
}

function isSummaryRow(row: string[]): boolean {
  // "Keterangan", ":" ... "Sub Total", ":" ... "Diskon", ":" ... "Total", ":"
  return row.some((c) => c === "Keterangan") && row.some((c) => c === "Total");
}

function parseHeaderRow(row: string[]): PembelianHeader {
  const header: PembelianHeader = {};

  // parse label ":" value
  const labels = new Set([
    "Nomor",
    "Admin",
    "Tanggal",
    "Pemasok",
    "Jatuh Tempo",
  ]);
  for (let i = 0; i < row.length; i++) {
    const cell = row[i];
    if (!labels.has(cell)) continue;

    // seringnya format: Label, ":", Value
    const colon = row[i + 1];
    const val = row[i + 2];

    if (colon !== ":") continue;

    if (cell === "Nomor") header.nomor = toText(val) || undefined;
    if (cell === "Admin") header.admin = toText(val) || undefined;
    if (cell === "Tanggal") header.tanggal = parseDateDDMMYYYY(val);
    if (cell === "Pemasok") header.pemasok = toText(val) || undefined;
    if (cell === "Jatuh Tempo") header.jatuhTempo = parseDateDDMMYYYY(val);
  }

  // lokasi: biasanya ada teks (mis. "SALATIGA") sebelum table header "No"
  const noIdx = row.findIndex((c) => c === "No");
  if (noIdx > 0) {
    const candidate = toText(row[noIdx - 1]);
    // pastikan bukan ":" atau label
    if (candidate && candidate !== ":" && !labels.has(candidate)) {
      header.lokasi = candidate;
    }
  }

  return header;
}

function parseItemRow(row: string[]): PembelianItem | null {
  // No | Kode | Nama | Kuantitas | Sat | Harga Beli | Diskon | Jumlah
  const no = parseNumberSmart(row[0]);
  if (no == null) return null;

  const item: PembelianItem = {
    no: Math.trunc(no),
    kode: toText(row[1]),
    nama: toText(row[2]),
    kuantitas: parseNumberSmart(row[3]),
    sat: toText(row[4]),
    hargaBeli: parseNumberSmart(row[5]),
    diskon: parseNumberSmart(row[6]),
    jumlah: parseNumberSmart(row[7]),
  };

  // minimal validation: harus punya kode/nama
  if (!item.kode && !item.nama) return null;

  return item;
}

function parseSummaryRow(row: string[]): PembelianSummary {
  const summary: PembelianSummary = {};

  // format contoh:
  // Keterangan, :, <text>, Sub Total, :, <num>, Diskon, :, <num>, Total, :, <num>
  for (let i = 0; i < row.length; i++) {
    const cell = row[i];

    if (cell === "Keterangan" && row[i + 1] === ":") {
      const ket = toText(row[i + 2]);
      summary.keterangan = ket === "" ? null : ket;
    }
    if (cell === "Sub Total" && row[i + 1] === ":") {
      summary.subTotal = parseNumberSmart(row[i + 2]);
    }
    if (cell === "Diskon" && row[i + 1] === ":") {
      summary.diskon = parseNumberSmart(row[i + 2]);
    }
    if (cell === "Total" && row[i + 1] === ":") {
      summary.total = parseNumberSmart(row[i + 2]);
    }
  }

  return summary;
}

function readPembelianXls(filePath: string): PembelianDoc {
  const wb = XLSX.readFile(filePath, { raw: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Excel tidak punya sheet.");

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  const doc: PembelianDoc = { pembelian: [] };

  // normalisasi jadi string[] per row
  const normalized: string[][] = rows.map((r) => (r as unknown[]).map(toText));

  // row 1 meta (opsional)
  if (normalized.length > 0) {
    const r0 = normalized[0];
    const anyMeta = r0.some((x) => x !== "");
    if (anyMeta) {
      doc.meta = {
        app: r0[0] || undefined,
        report: r0[1] || undefined,
        address: r0[2] || undefined,
        phone: r0[3] || undefined,
      };
    }
  }

  let current: PembelianEntry | null = null;

  for (let i = 1; i < normalized.length; i++) {
    const row = normalized[i];
    if (!row || row.every((c) => c === "")) continue;

    // start transaksi baru
    if (isLikelyPurchaseHeaderRow(row)) {
      // push transaksi sebelumnya (kalau ada)
      if (current) doc.pembelian.push(current);

      current = {
        header: parseHeaderRow(row),
        items: [],
      };
      continue;
    }

    // kalau belum masuk transaksi, skip
    if (!current) continue;

    // footer/summary transaksi
    if (isSummaryRow(row)) {
      current.summary = parseSummaryRow(row);
      continue;
    }

    // item row
    if (isItemRow(row)) {
      const item = parseItemRow(row);
      if (item) current.items.push(item);
      continue;
    }

    // selain itu abaikan (baris lain/report noise)
  }

  // transaksi terakhir
  if (current) doc.pembelian.push(current);

  return doc;
}

// ====== USAGE ======
const xlsPath = path.resolve(process.cwd(), "scripts", "PEMBELIAN.xls");

// variable JSON nested yang kamu minta:

const seed = async () => {
  const pembelianJson: PembelianDoc = readPembelianXls(xlsPath);

  // 1. Ensure Admin User Exists
  const PASSWORD = "12345678";
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  let adminUser = await prisma.user.findFirst({ where: { name: "admin" } });
  if (!adminUser) {
    console.log("Creating admin user...");
    adminUser = await prisma.user.create({
      data: {
        name: "admin",
        password: hashedPassword,
        isActive: true,
        isSuperUser: true,
      },
    });
  }

  // 2. Generate Token
  const token = jwt.sign(
    { userId: adminUser.id, name: adminUser.name },
    JWT_SECRET,
    { expiresIn: "1h" },
  );

  axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  let firstBranch = await prisma.branch.findFirst();

  if (!firstBranch) {
    console.log("Creating default branch...");
    firstBranch = await prisma.branch.create({
      data: {
        code: "PUSAT",
        name: "Pusat",
        address: "Salatiga",
        phone: "08123456789",
      },
    });
  }

  const itemWithVariant = await prisma.masterItem.findMany({
    include: {
      masterItemVariants: {
        include: {
          masterItem: true,
        },
      },
    },
  });

  const allVariants = itemWithVariant.flatMap(
    (item) => item.masterItemVariants,
  );

  const suppliers = await prisma.masterSupplier.findMany();

  // Create map for variant lookup by code + unit
  const variantMap = new Map<string, any>();

  itemWithVariant.forEach((item) => {
    item.masterItemVariants.forEach((v) => {
      // Key: ITEMCODE|UNIT
      const key = `${item.code.trim().toUpperCase()}|${v.unit.trim().toUpperCase()}`;
      variantMap.set(key, {
        masterItemId: item.id,
        masterItemVariantId: v.id,
        purchasePrice: item.recordedBuyPrice || 0, // Use recorded buy price
      });
    });
  });

  console.log(`Loaded ${variantMap.size} variants for lookup.`);

  // Hardcoded mapping from Excel Name to DB Code
  const SUPPLIER_MAP: Record<string, string> = {
    INDOMARCO: "IDM",
    MAYORA: "MYR",
    SOLO: "SL",
    WINGS: "WGS",
    DIPLOMAT: "DPL",
    "COCA COLA": "CCL",
    SURUH: "SRH",
    UNILEVER: "UNN",
    MALANG: "ML",
    UMUM: "UMM",
    "LUWAK COFFE": "LWK",
    CIMORY: "CMR",
    DJARUM: "DRM",
    ARTABOGA: "ATB",
    PELANGI: "PLG",
    DANDANG: "DDG",
    SALATIGA: "SL3",
  };

  // Fetch a default category for new items (e.g., first one found or specific code)
  const defaultCategory = await prisma.masterItemCategory.findFirst();
  if (!defaultCategory) {
    throw new Error("No MasterItemCategory found. Cannot create new items.");
  }

  // Map for Item lookup (Code -> ID) to check if item exists even if variant doesn't
  const itemMap = new Map<string, number>();
  itemWithVariant.forEach((item) => {
    itemMap.set(item.code.trim().toUpperCase(), item.id);
  });

  for (const purc of pembelianJson.pembelian) {
    const { header, items, summary } = purc;
    const { nomor, admin, tanggal, pemasok, jatuhTempo, lokasi } = header;

    console.log(`Processing Invoice: ${nomor}`);

    // 1. Validate Supplier
    let supplierCode = "";

    // Check mapping first
    if (pemasok && SUPPLIER_MAP[pemasok.toUpperCase()]) {
      supplierCode = SUPPLIER_MAP[pemasok.toUpperCase()];
    }

    // Find in DB
    let supplier = suppliers.find(
      (s) =>
        s.code === supplierCode ||
        s.name.toLowerCase() === pemasok?.toLowerCase(),
    );

    if (!supplier) {
      if (pemasok) {
        console.log(`Creating missing supplier: ${pemasok}`);
        try {
          // Create new supplier if not found
          supplier = await prisma.masterSupplier.create({
            data: {
              code: supplierCode || pemasok.substring(0, 5).toUpperCase(), // Fallback code
              name: pemasok,
            },
          });
          suppliers.push(supplier); // Add to local cache
        } catch (e) {
          console.error(`Failed to create supplier ${pemasok}`, e);
          continue;
        }
      } else {
        console.error(`Skipping ${nomor}: Supplier name missing`);
        continue;
      }
    }

    // 2. Map Items to Payload (Async to handle creation)
    const purchaseItems: any[] = [];

    for (const item of items) {
      const itemCode = item.kode.trim().toUpperCase();
      const itemUnit = item.sat.trim().toUpperCase();
      const key = `${itemCode}|${itemUnit}`;

      let variant = variantMap.get(key);

      if (!variant) {
        console.log(
          `Missing data for ${item.nama} (${itemCode}) - ${itemUnit}. Creating...`,
        );

        try {
          // Check if Master Item exists
          let masterItemId = itemMap.get(itemCode);

          if (!masterItemId) {
            // Create Master Item
            const newItem = await prisma.masterItem.create({
              data: {
                code: item.kode,
                name: item.nama,
                isActive: true,
                masterSupplierId: supplier.id,
                masterItemCategoryId: defaultCategory.id,
                recordedBuyPrice: item.hargaBeli || 0,
              },
            });
            masterItemId = newItem.id;
            itemMap.set(itemCode, masterItemId);
            console.log(`  -> Created MasterItem: ${item.nama}`);
          }

          // Create Master Item Variant
          const newVariant = await prisma.masterItemVariant.create({
            data: {
              masterItemId: masterItemId,
              unit: item.sat,
              amount: 1, // Default conversion 1 if unknown. Logic might need adj if known ratio.
              sellPrice: 0,
              recordedBuyPrice: 0,
              recordedProfitPercentage: 0,
              recordedProfitAmount: 0,
              isBaseUnit: false, // Defaulting to false unless sure
            },
          });

          variant = {
            masterItemId: masterItemId,
            masterItemVariantId: newVariant.id,
            purchasePrice: item.hargaBeli || 0,
          };

          variantMap.set(key, variant);
          console.log(`  -> Created Variant: ${itemUnit}`);
        } catch (err) {
          console.error(
            `  -> Failed to create item/variant for ${itemCode}`,
            err,
          );
          continue; // Skip this item
        }
      }

      purchaseItems.push({
        masterItemVariantId: variant.masterItemVariantId,
        qty: item.kuantitas || 0,
        purchasePrice: item.hargaBeli || 0,
        discounts: item.discounts ? [{ percentage: item.discounts }] : [],
      });
    }

    if (purchaseItems.length === 0) {
      console.warn(`Skipping ${nomor}: No items found`);
      continue;
    }

    // 3. Construct Payload
    const payload = {
      invoiceNumber: nomor || `INV-${Date.now()}`,
      transactionDate: new Date(tanggal || new Date()),
      dueDate: new Date(jatuhTempo || new Date()),
      masterSupplierCode: supplier.code,
      branchId: firstBranch.id,
      notes: summary?.keterangan || "",
      taxPercentage: 0,
      items: purchaseItems,
    };

    // 4. Call API
    try {
      const response = await axiosInstance.post(
        "/transaction/purchase",
        payload,
      );
      console.log(`Success: ${nomor} -> ID: ${response.data.data.id}`);
    } catch (error: any) {
      console.error(`Failed: ${nomor}`);
      if (axios.isAxiosError(error)) {
        console.error(JSON.stringify(error.response?.data, null, 2));
      } else {
        console.error(error.message);
      }
    }
  }
};

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
