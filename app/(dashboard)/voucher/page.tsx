import { AiTextRecordParser } from "@/app/_components/ai-text-record-parser";
import { RecordManager } from "@/app/_components/record-manager";
import { VoucherTools } from "@/app/_components/voucher-tools";
import { listProducts } from "@/lib/api/products";
import { listVouchers } from "@/lib/api/voucher";

export default async function VoucherPage() {
  const [rows, products] = await Promise.all([listVouchers(), listProducts()]);
  return (
    <VoucherTools
      create={<AiTextRecordParser definitionKey="vouchers" fields={[{ name: "nama_event", label: "Event name", required: true }, { name: "kode", label: "Code", required: true }, { name: "tipe", label: "Type", type: "select", options: ["Flash Sale", "Mega Sale", "Bundle Sale", "Voucher Gift"] }, { name: "periode_mulai", label: "Start date", type: "date", required: true }, { name: "periode_selesai", label: "End date", type: "date", required: true }, { name: "diskon_persen", label: "Discount percent", type: "number" }, { name: "maks_potongan", label: "Maximum discount", type: "number" }, { name: "min_transaksi", label: "Minimum transaction", type: "number" }, { name: "notes", label: "Notes", type: "textarea" }]} kind="voucher" title="Create voucher from text" />}
      manage={<RecordManager definitionKey="vouchers" rows={rows} />}
      products={products}
      referenceDate={new Date().toISOString()}
      rows={rows}
    />
  );
}
