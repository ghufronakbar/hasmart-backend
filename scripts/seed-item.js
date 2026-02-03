"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/seed-item.ts
const node_path_1 = __importDefault(require("node:path"));
const XLSX = __importStar(require("xlsx"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Kolom excel -> field interface
const COL_MAP = {
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
const NUM_FIELDS = new Set([
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
function toText(v) {
    if (v == null)
        return "";
    return String(v).trim();
}
/**
 * Parse angka dari format:
 * - "1,384.92" (comma thousand, dot decimal)
 * - "1.384,92" (dot thousand, comma decimal)
 * - "10.00", "10", "0.00"
 * - "" => null
 */
function parseNumberSmart(v) {
    if (v == null)
        return null;
    if (typeof v === "number")
        return Number.isFinite(v) ? v : null;
    let s = String(v).trim();
    if (s === "")
        return null;
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
        }
        else {
            // "1.384,92" => remove dots then comma->dot
            s = s.replace(/\./g, "").replace(/,/g, ".");
        }
    }
    else if (hasComma && !hasDot) {
        // Bisa "1,234" (thousand) atau "12,5" (decimal)
        if (/^\d{1,3}(,\d{3})+$/.test(s)) {
            s = s.replace(/,/g, "");
        }
        else {
            s = s.replace(/,/g, ".");
        }
    }
    else if (!hasComma && hasDot) {
        // Bisa "1.234" (thousand) atau "12.5" (decimal)
        if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
            s = s.replace(/\./g, "");
        }
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}
function readXlsAsItems(filePath) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    // raw:false => ambil nilai "formatted text" (lebih aman untuk KodeItem panjang)
    const wb = XLSX.readFile(filePath, { raw: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName)
        throw new Error("Excel tidak punya sheet.");
    const ws = wb.Sheets[sheetName];
    // header:1 => array-of-arrays, supaya kita kontrol mapping + string safety
    const rows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
    });
    if (rows.length < 2)
        return [];
    const headers = rows[0].map((h) => toText(h));
    const items = [];
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0)
            continue;
        const obj = {};
        for (let c = 0; c < headers.length; c++) {
            const h = headers[c];
            const key = COL_MAP[h];
            if (!key)
                continue;
            const cell = row[c];
            if (NUM_FIELDS.has(key)) {
                obj[key] = parseNumberSmart(cell);
            }
            else {
                obj[key] = toText(cell);
            }
        }
        // Skip baris kosong
        const kodeItem = ((_a = obj.kodeItem) !== null && _a !== void 0 ? _a : "").trim();
        const namaItem = ((_b = obj.namaItem) !== null && _b !== void 0 ? _b : "").trim();
        if (!kodeItem && !namaItem)
            continue;
        // Normalisasi optional: Satuan2 bisa kosong => null
        const satuan2 = ((_c = obj.satuan2) !== null && _c !== void 0 ? _c : "").trim();
        obj.satuan2 = satuan2 === "" ? null : satuan2;
        // Pastikan required minimal ada (sesuaikan kebutuhanmu)
        if (!kodeItem) {
            throw new Error(`Row ${r + 1}: KodeItem kosong`);
        }
        if (!namaItem) {
            throw new Error(`Row ${r + 1}: NamaItem kosong (KodeItem=${kodeItem})`);
        }
        // Default untuk field string wajib kalau kosong
        obj.kodeJenis = ((_d = obj.kodeJenis) !== null && _d !== void 0 ? _d : "").trim();
        obj.kodePemasok = ((_e = obj.kodePemasok) !== null && _e !== void 0 ? _e : "").trim();
        obj.satuan1 = ((_f = obj.satuan1) !== null && _f !== void 0 ? _f : "").trim();
        obj.upload = ((_g = obj.upload) !== null && _g !== void 0 ? _g : "").trim();
        obj.tipe = ((_h = obj.tipe) !== null && _h !== void 0 ? _h : "").trim();
        items.push(obj);
    }
    return items;
}
// ====== USAGE ======
const xlsPath = node_path_1.default.resolve(process.cwd(), "scripts", "DATAITEMBARANG.xls");
// Ini variable JSON yang kamu minta:
const seeds = async () => {
    const itemsJson = readXlsAsItems(xlsPath);
    // Contoh cek output:
    //   console.log(`Loaded items: ${itemsJson.length}`);
    //   console.log(itemsJson[0]);
    const uniqueSupplier = new Set();
    const uniqueUnit = new Set();
    const uniqueCategory = new Set();
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
        const suppliers = await Promise.all(Array.from(uniqueSupplier).map((code) => {
            const supplier = tx.masterSupplier.create({
                data: {
                    code,
                    name: code,
                },
            });
            console.log("Supplier created", supplier);
            return supplier;
        }));
        // create unit
        const units = await Promise.all(Array.from(uniqueUnit).map((code) => {
            const unit = tx.masterUnit.create({
                data: {
                    name: code,
                    unit: code,
                },
            });
            console.log("Unit created", unit);
            return unit;
        }));
        // create category
        const categories = await Promise.all(Array.from(uniqueCategory).map((code) => {
            const category = tx.masterItemCategory.create({
                data: {
                    code,
                    name: code,
                },
            });
            console.log("Category created", category);
            return category;
        }));
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
            console.log("Item created", createdItem.name, "total variant", createdItem._count.masterItemVariants);
        }
    });
};
seeds().catch((err) => {
    console.error(err);
    process.exit(1);
});
