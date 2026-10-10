// ---------- Farms & plots ----------
export interface Farm {
  id: string;
  name: string;
  location: string;
  sizeAcres: number;
  partners: string[]; // partner names + share notes
  notes?: string;
}

/** Crop-cycle milestones, in the order they occur in the field. */
export const PLOT_STAGES = [
  "sowing",
  "planting",
  "transplanting",
  "flowering",
  "harvesting",
  "fallow",
] as const;

export type PlotStage = (typeof PLOT_STAGES)[number];

export const PLOT_STAGE_LABELS: Record<PlotStage, string> = {
  sowing: "Sowing",
  planting: "Planting",
  transplanting: "Transplanting",
  flowering: "Flowering",
  harvesting: "Harvesting",
  fallow: "Fallow",
};

/** Each stage holds an ISO date; every stage is optional until it happens. */
export type PlotCycle = Partial<Record<PlotStage, string>>;

/** A past crop cycle, archived off a plot when a new one is started. */
export interface PlotCycleRecord {
  id: string;
  cropId: string;
  variety?: string;
  /** Workers who handled the plot during this cycle. */
  workerIds: string[];
  /** @deprecated single-worker field from older saves; migrated to `workerIds` on read. */
  workerId?: string;
  cycle: PlotCycle;
  /** ISO date the cycle was archived (i.e. when the new one began). */
  archivedAt: string;
}

export interface Plot {
  id: string;
  farmId: string;
  name: string;
  sizeAcres: number;
  cropId: string;
  variety?: string; // e.g. "Kulai", "Centel F1"
  /** Workers handling this plot - a plot can have more than one. */
  workerIds: string[];
  /** @deprecated single-worker field from older saves; migrated to `workerIds` on read. */
  workerId?: string;
  cycle: PlotCycle;
  /** Past cycles for this plot, most recent first. See "Start New Cycle". */
  history: PlotCycleRecord[];
  /** @deprecated superseded by `cycle.planting`; kept so saves made before
   *  the cycle fields existed still load. Migrated on read in lib/store. */
  plantedDate?: string;
  status: "Active" | "Fallow" | "Preparing";
}

export interface Crop {
  id: string;
  name: string;
  commissionRatePerKg: number; // RM per kg harvested, paid to worker
}

/** A named variety of one crop, selectable everywhere a variety is recorded. */
export interface Variety {
  id: string;
  cropId: string;
  name: string;
}

// ---------- Rental contracts ----------
export interface RentalContract {
  id: string;
  farmId: string;
  landlord: string;
  monthlyRent: number;
  startDate: string;
  endDate: string;
  depositPaid: number;
  notes?: string;
  paidMonths: string[]; // "2026-07" months where rent was paid
}

// ---------- Loans ----------
export interface Loan {
  id: string;
  lender: string;
  lenderType: "Bank" | "Relative" | "Friend";
  principal: number;
  interestRatePct: number; // annual %
  monthlyInstallment: number;
  startDate: string;
  tenureMonths: number;
  paidMonths: string[]; // "2026-07"
  /**
   * Known outstanding balance as of `balanceAsOfDate`, for a loan added to the
   * dashboard partway through repayment — overrides the principal-minus-paid-
   * months calculation, and months remaining is derived from it instead of
   * `tenureMonths`. Leave unset for a loan tracked from its first payment.
   */
  currentBalance?: number;
  balanceAsOfDate?: string;
  notes?: string;
}

// ---------- Setup projects (third-party contractors) ----------
export interface SetupProject {
  id: string;
  farmId: string;
  contractor: string;
  jobType: string; // Land clearing, Fencing, Tilling ...
  quotedCharge: number;
  amountPaid: number;
  startDate: string;
  expectedEndDate: string;
  actualEndDate?: string;
  status: "In Progress" | "Delayed" | "Completed";
  notes?: string;
}

// ---------- Workers ----------
export interface Worker {
  id: string;
  name: string;
  idNumber: string; // IC / passport
  dob?: string;
  phone: string;
  nationality: string;
  joinDate: string;
  baseSalary: number;
  farmId: string; // farm in charge
  active: boolean;
}

/**
 * A worker's harvest-commission rate for one crop(+variety), overriding the
 * crop's global `commissionRatePerKg` for that worker — wherever they harvest
 * it, since the same plot gets replanted with different crops over time.
 * Matching prefers an exact variety match, then a blank-variety ("any
 * variety") setting, before falling back to the crop's global rate.
 *
 * This only sets the rate for *new* harvest records going forward — see
 * `HarvestRecord.commissionRate`, which locks in the rate actually used at
 * the time, so editing a setting here never rewrites past commission,
 * payslip or expense figures.
 */
export interface WorkerCommissionSetting {
  id: string;
  workerId: string;
  cropId: string;
  variety?: string; // blank = applies to any variety of this crop
  ratePerKg: number; // RM per kg harvested
}

/** A target harvest volume for a worker over a date range, on one farm+plot+crop(+variety). */
export interface WorkerHarvestTarget {
  id: string;
  workerId: string;
  startDate: string;
  endDate: string;
  farmId: string;
  plotId: string;
  cropId: string;
  variety?: string; // blank = any variety
  targetKg: number;
}

export type WorkerExpenseType =
  | "Groceries"
  | "Phone Top-up"
  | "Cigarettes"
  | "Cash Advance"
  | "Other";

export interface WorkerExpense {
  id: string;
  workerId: string;
  date: string;
  type: WorkerExpenseType;
  description: string;
  amount: number;
  deductFromSalary: boolean;
}

// ---------- Harvests (drives commission) ----------
export interface HarvestRecord {
  id: string;
  date: string;
  plotId: string;
  workerId: string;
  cropId: string;
  variety?: string;
  quantityKg: number;
  /**
   * RM/kg locked in when this harvest was recorded (from the worker's
   * Commission Setting or the crop's default rate at the time). Commission,
   * payroll and payslip figures always use this stored rate, never a live
   * lookup — so changing a Commission Setting later never rewrites history.
   */
  commissionRate: number;
}

// ---------- Wastage (harvest that was never sold) ----------
export type WasteReason = "Rotten / spoiled" | "Damaged" | "Rejected by collector" | "Own use / given away" | "Other";

/** Harvested kg that left stock without being sold - the farm absorbs its cost. */
export interface WasteRecord {
  id: string;
  date: string;
  plotId: string;
  cropId: string;
  quantityKg: number;
  reason: WasteReason;
  notes?: string;
}

// ---------- Schedule ----------
export interface ScheduleTask {
  id: string;
  date: string;
  farmId: string;
  plotId?: string;
  workerId: string;
  task: string;
  status: "Planned" | "In Progress" | "Done";
  /** Free-text detail for the worker — instructions, dosage, cautions. */
  remarks?: string;
}

// ---------- Business partner details (Collectors & Vendors) ----------
export interface BankAccount {
  bankName: string;
  recipientName: string;
  accountNumber: string;
}

/** Shared business-profile fields, set from Settings → Collectors & Vendors. */
export interface BusinessProfile {
  businessRegNo?: string;
  picName?: string; // person in charge
  email?: string;
  officeAddress?: string;
  tinNumber?: string;
  bankAccount?: BankAccount;
}

// ---------- Collectors & sales ----------
export interface Collector extends BusinessProfile {
  id: string;
  name: string; // business name
  phone: string;
  paymentTermDays: number; // usually 2-7 days
}

export interface SaleGradeLine {
  grade: string; // A / B / C
  quantityKg: number;
  pricePerKg: number;
}

export interface SaleRecord {
  id: string;
  date: string;
  collectorId: string;
  cropId: string;
  farmId: string;
  grades: SaleGradeLine[];
  paymentStatus: "Pending" | "Received";
  paymentReceivedDate?: string;
}

// ---------- Suppliers (Vendors), purchases, inventory ----------
export interface Supplier extends BusinessProfile {
  id: string;
  name: string; // business name
  phone: string;
  paymentTermDays?: number;
}

export interface InventoryItem {
  id: string;
  name: string; // our standard name
  /** Name of an Expense Category (Expenses > Expense Category). */
  category: string;
  /** Base unit stock is counted in - kg, L, pcs, roll... - so a pack can be split into any amount. */
  unit: string;
  /** Base units in one pack as bought (a 25 kg bag = 25). Blank/1 = bought in base units. */
  packSize?: number;
  /** What one pack is called on the invoice: "bag", "bottle", "pack"... */
  packLabel?: string;
  /** Total on hand across the main store and every farm, in base units. */
  stock: number;
  /**
   * Part of `stock` already handed to each farm (farmId -> base units). The rest,
   * stock minus the sum of these, is the Main (unallocated) balance.
   */
  farmStock?: Record<string, number>;
  minStock: number; // base units, against total stock
  /** Cost of one base unit (per kg / per L / per pc) at the last purchase. */
  lastCostPerUnit: number;
  aliases: { supplierId: string; aliasName: string }[]; // invoice names differ by supplier
  trackInventory: boolean;
}

/** One movement of stock into (+) or out of (−) a farm's share: a purchase split or a transfer. */
export interface StockAllocation {
  id: string;
  date: string;
  itemId: string;
  farmId: string;
  quantity: number; // base units; negative when pulled back out of the farm
  unitCost: number; // cost per base unit when it moved
  purchaseId?: string;
  kind: "purchase" | "transfer";
}

/** A unit in the managed list (Setting > Units of Measure): a pack ("bag") or a measure ("kg"). */
export interface UnitOfMeasure {
  id: string;
  name: string;
  kind: "pack" | "measure";
}

/** A purchase/item category (Expenses > Expense Category). */
export interface ExpenseCategory {
  id: string;
  name: string;
  /** Not used up (tools, netting): charged to a farm when handed to it rather than when used. */
  durable?: boolean;
}

export interface PurchaseLine {
  itemId?: string; // linked inventory item (undefined = one-time, not tracked)
  invoiceName: string; // name as written on supplier invoice
  quantity: number; // number of packs, in `uom`
  unitPrice: number; // RM per pack
  /** What a pack is called on the invoice: bag, bottle, pcs... */
  uom?: string;
  /** Content of one pack, in `packUnit` (25 for a 25 kg bag). Stock added = quantity x packSize. */
  packSize?: number;
  packUnit?: string; // kg, L, pcs...
  category?: string; // Expense Category name
}

export interface Purchase {
  id: string;
  date: string;
  supplierId: string;
  lines: PurchaseLine[];
  paidBy: "Company" | "Own Pocket";
  claimStatus?: "To Claim" | "Claim Submitted" | "Reimbursed";
  receiptName?: string; // uploaded receipt file name
  receiptDataUrl?: string; // small screenshot/photo preview
  notes?: string;
}

// ---------- Ad-hoc company payments (Expenses → Payment) ----------
export type PaymentCategory =
  | "Utilities"
  | "Rental/Office"
  | "Transport"
  | "Professional Fees"
  | "Bank Charges"
  | "Other";

export interface Payment {
  id: string;
  date: string;
  category: PaymentCategory;
  payee: string;
  description: string;
  amount: number;
  /** Farm this bill belongs to, for crop costing. Blank = company-wide (spread over all farms). */
  farmId?: string;
  notes?: string;
}

export interface UsageLog {
  id: string;
  date: string;
  itemId: string;
  quantity: number;
  purpose: string;
  farmId?: string;
}

// ---------- Agri-input applications (spray rounds) ----------
export interface ApplicationProduct {
  itemId: string;
  ratePer100L: number; // dose per 100 L water
  quantityUsed: number; // actual qty used this round (L or kg)
  unitCost: number; // cost per L / per kg
}

export interface ApplicationRecord {
  id: string;
  date: string;
  farmId: string;
  plotId: string;
  target: "Pest" | "Disease" | "Weed" | "Foliar Feed" | "Mixed";
  waterVolumeL: number;
  products: ApplicationProduct[];
  notes?: string;
}

// ---------- App settings (Settings → Dashboard) ----------
export interface AppSettings {
  appName: string;
  appSubtitle: string;
  logoDataUrl?: string;
}

// ---------- Root DB ----------
export interface DB {
  farms: Farm[];
  plots: Plot[];
  crops: Crop[];
  varieties: Variety[];
  contracts: RentalContract[];
  loans: Loan[];
  projects: SetupProject[];
  workers: Worker[];
  workerExpenses: WorkerExpense[];
  commissionSettings: WorkerCommissionSetting[];
  harvestTargets: WorkerHarvestTarget[];
  harvests: HarvestRecord[];
  wastage: WasteRecord[];
  tasks: ScheduleTask[];
  collectors: Collector[];
  sales: SaleRecord[];
  suppliers: Supplier[];
  items: InventoryItem[];
  purchases: Purchase[];
  allocations: StockAllocation[];
  uoms: UnitOfMeasure[];
  expenseCategories: ExpenseCategory[];
  payments: Payment[];
  usageLogs: UsageLog[];
  applications: ApplicationRecord[];
  settings: AppSettings;
}
