export interface ReceiptItem {
  name: string;
  qty: number;
  unit: string;
  price: string;
  discount: string;
  total: string;
}

export interface ReceiptData {
  storeName: string;
  address: string;
  phone: string;
  transactionDate: Date;
  invoiceNumber: string;
  customerName: string;
  cashierName: string;
  items: ReceiptItem[];
  subTotal: string;
  globalDiscount: string;
  showTax: boolean;
  tax: string;
  totalAmount: string;
  payAmount: string;
  changeAmount: string;
}
