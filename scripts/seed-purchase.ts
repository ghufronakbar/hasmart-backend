// scripts/seed-purchase.ts
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import axios from "axios";

const accessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsIm5hbWUiOiJhZG1pbiIsImlhdCI6MTc3MDQ1MjAyNn0.ll__lZz73AQvNrOEQlu62l6gEHVjuiWav1JPyJpg--c";

const axiosInstance = axios.create({
  baseURL: "http://localhost:9999/api",
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

const prisma = new PrismaClient();

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

  const users = await prisma.user.findMany();

  const firstBranch = await prisma.branch.findFirst();
  const PASSWORD = "12345678";
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  if (!firstBranch) {
    throw new Error("Branch not found");
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

  for await (const purc of pembelianJson.pembelian) {
    const { header, items, summary } = purc;
    const { nomor, admin, tanggal, pemasok, jatuhTempo, lokasi } = header;

    let adminId = 0;
    let countAdmin = 0;

    if (admin) {
      const user = users.find((u) => u.name === admin);
      if (user) {
        adminId = user.id;
      } else {
        const newUser = await prisma.user.create({
          data: {
            name: admin,
            password: hashedPassword,
            isActive: true,
            isSuperUser: countAdmin === 0 ? true : false,
          },
        });
        adminId = newUser.id;
        countAdmin++;
      }
    }

    const supplier = suppliers.find(
      (s) => s.name.toLowerCase() === pemasok?.toLowerCase(),
    );
    if (!supplier) {
      throw new Error(`Supplier ${pemasok} not found`);
    }

    const createPurchase = await prisma.transactionPurchase.create({
      data: {
        branchId: firstBranch.id,
        invoiceNumber: nomor || `NO-INVOICE-${Date.now()}`,
        dueDate: new Date(jatuhTempo || new Date()),
        masterSupplierId: supplier.id,
        recordedDiscountAmount: 0,
        recordedSubTotalAmount: 0,
        recordedTotalAmount: 0,
        recordedTaxAmount: 0,
        recordedTaxPercentage: 0,
        transactionDate: new Date(tanggal || new Date()),
        transactionPurchaseItems: {
          createMany: {
            data: purc.items.map((item) => {
              const findItem = itemWithVariant.find(
                (i) => i.code.toLowerCase() === item.kode.toLowerCase(),
              );
              if (!findItem) {
                throw new Error(`Item ${item.nama} not found`);
              }
              const findVariant = findItem.masterItemVariants.find(
                (v) => v.unit.toLowerCase() === item.sat.toLowerCase(),
              );
              if (!findVariant) {
                throw new Error(
                  `Variant ${findItem.name} ${item.sat} not found`,
                );
              }
              return {
                masterItemId: findItem.id,
                masterItemVariantId: findVariant.id,
                purchasePrice: 0,
                qty: 0,
                recordedAfterTaxAmount: 0,
                recordedConversion: 0,
                recordedDiscountAmount: 0,
                recordedSubTotalAmount: 0,
                recordedTotalAmount: 0,
                totalQty: 0,
              };
            }),
          },
        },
      },
    });
  }

  // debug
  // console.log(`Loaded pembelian entries: ${pembelianJson.pembelian.length}`);
  // console.log(pembelianJson.pembelian[0]);
};
seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
