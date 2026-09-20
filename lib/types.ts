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

export interface Plot {
  id: string;
  farmId: string;
  name: string;
  sizeAcres: number;
  cropId: string;
  variety?: string; // e.g. "Kulai", "Centel F1"
  workerId: string; // worker managing this plot
  cycle: PlotCycle;
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
  phone: string;
  nationality: string;
  joinDate: string;
  baseSalary: number;
  farmId: string;
  active: boolean;
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
  quantityKg: number;
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

// ---------- Collectors & sales ----------
export interface Collector {
  id: string;
  name: string;
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

// ---------- Suppliers, purchases, inventory ----------
export interface Supplier {
  id: string;
  name: string;
  phone: string;
}

export interface InventoryItem {
  id: string;
  name: string; // our standard name
  category: "Fertilizer" | "Pesticide" | "Fungicide" | "Herbicide" | "Tools" | "Materials" | "Other";
  unit: string; // kg, L, bag, roll...
  stock: number;
  minStock: number;
  lastCostPerUnit: number;
  aliases: { supplierId: string; aliasName: string }[]; // invoice names differ by supplier
  trackInventory: boolean;
}

export interface PurchaseLine {
  itemId?: string; // linked inventory item (undefined = one-time, not tracked)
  invoiceName: string; // name as written on supplier invoice
  quantity: number;
  unitPrice: number;
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

// ---------- Root DB ----------
export interface DB {
  farms: Farm[];
  plots: Plot[];
  crops: Crop[];
  contracts: RentalContract[];
  loans: Loan[];
  projects: SetupProject[];
  workers: Worker[];
  workerExpenses: WorkerExpense[];
  harvests: HarvestRecord[];
  tasks: ScheduleTask[];
  collectors: Collector[];
  sales: SaleRecord[];
  suppliers: Supplier[];
  items: InventoryItem[];
  purchases: Purchase[];
  usageLogs: UsageLog[];
  applications: ApplicationRecord[];
}
