export interface PurchaseReportItemDetail {
  itemName: string;
  variantName: string;
  qty: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
}

export interface PurchaseReportItem {
  id: number;
  transactionDate: Date;
  invoiceNumber: string;
  supplierName: string;
  subTotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  status?: string;
  items: PurchaseReportItemDetail[];
}

export interface ReportResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface PurchaseReturnReportItemDetail {
  itemName: string;
  variantName: string;
  qty: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
}

export interface PurchaseReturnReportItem {
  id: number;
  transactionDate: Date;
  invoiceNumber: string;
  supplierName: string;
  subTotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  items: PurchaseReturnReportItemDetail[];
}

export interface SalesReportItemDetail {
  itemName: string;
  variantName: string;
  qty: number;
  price: number;
  discount: number;
  total: number;
}

export interface SalesReportItem {
  id: number;
  transactionDate: Date;
  invoiceNumber: string;
  subTotal: number;
  discount: number;
  totalAmount: number;
  items: SalesReportItemDetail[];
}

export interface SalesReturnReportItemDetail {
  itemName: string;
  variantName: string;
  qty: number;
  price: number;
  discount: number;
  total: number;
}

export interface SalesReturnReportItem {
  id: number;
  transactionDate: Date;
  returnNumber: string; // Sales Return uses returnNumber
  invoiceNumberRef: string; // Reference to original Sales Invoice
  subTotal: number;
  discount: number;
  totalAmount: number;
  items: SalesReturnReportItemDetail[];
}

export interface SellReportItemDetail {
  itemName: string;
  variantName: string;
  qty: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
}

export interface SellReportItem {
  id: number;
  transactionDate: Date;
  invoiceNumber: string;
  customerName: string;
  subTotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  dueDate: Date;
  items: SellReportItemDetail[];
}

export interface SellReturnReportItemDetail {
  itemName: string;
  variantName: string;
  qty: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
}

export interface SellReturnReportItem {
  id: number;
  transactionDate: Date;
  invoiceNumber: string; // Return Number
  customerName: string;
  subTotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  items: SellReturnReportItemDetail[];
}
