import { DB } from "./types";

/**
 * DEMO DATA ONLY — every name, ID, phone number and figure below is invented.
 *
 * ⚠️  Do NOT put real worker, landlord or lender details in this file.
 *     This file is committed to git and published with the repository, so real
 *     passport numbers, phone numbers or salaries added here become public and
 *     stay in git history permanently — even if deleted in a later commit.
 *
 *     Real records belong in the running app (Workers → Add Worker, etc.).
 *     They are saved to your browser's local storage on your own device and
 *     never leave it.
 */
export const seedDB: DB = {
  crops: [
    { id: "c1", name: "Chili", commissionRatePerKg: 0.3 },
    { id: "c2", name: "Long Bean", commissionRatePerKg: 0.2 },
    { id: "c3", name: "Cucumber", commissionRatePerKg: 0.12 },
    { id: "c4", name: "Okra", commissionRatePerKg: 0.25 },
  ],

  farms: [
    {
      id: "f1",
      name: "Sungai Ruan Farm",
      location: "Raub, Pahang",
      sizeAcres: 12,
      partners: ["Self (60%)", "Mr. Tan (40%)"],
      notes: "Main farm, chili + long bean",
    },
    {
      id: "f2",
      name: "Bukit Tinggi Farm",
      location: "Bentong, Pahang",
      sizeAcres: 8,
      partners: ["Self (50%)", "Ah Hock (30%)", "Mdm. Lee (20%)"],
    },
    {
      id: "f3",
      name: "Kampung Baru Farm",
      location: "Kuala Pilah, N. Sembilan",
      sizeAcres: 5,
      partners: ["Self (100%)"],
      notes: "New farm, still in setup phase",
    },
  ],

  plots: [
    // Chili: sown in nursery, transplanted out, ~4 months to first harvest.
    { id: "p1", farmId: "f1", name: "Plot A", sizeAcres: 4, cropId: "c1", variety: "Kulai Red", workerId: "w1", status: "Active",
      cycle: { sowing: "2026-02-10", planting: "2026-03-10", transplanting: "2026-03-18", flowering: "2026-05-02", harvesting: "2026-06-14" } },
    { id: "p2", farmId: "f1", name: "Plot B", sizeAcres: 3, cropId: "c2", variety: "Long Bean 101", workerId: "w2", status: "Active",
      cycle: { sowing: "2026-03-20", planting: "2026-04-02", flowering: "2026-05-14", harvesting: "2026-06-05" } },
    // A finished cycle, so the average-cycle figure has something to average.
    { id: "p3", farmId: "f1", name: "Plot C", sizeAcres: 5, cropId: "c1", variety: "Bara F1", workerId: "w3", status: "Fallow",
      cycle: { sowing: "2026-04-22", planting: "2026-05-20", transplanting: "2026-05-29", flowering: "2026-07-08", harvesting: "2026-08-16", fallow: "2026-09-12" } },
    { id: "p4", farmId: "f2", name: "Plot A", sizeAcres: 4, cropId: "c3", variety: "Green Star", workerId: "w4", status: "Active",
      cycle: { sowing: "2026-04-01", planting: "2026-04-15", flowering: "2026-05-20", harvesting: "2026-06-08" } },
    { id: "p5", farmId: "f2", name: "Plot B", sizeAcres: 4, cropId: "c4", variety: "Clemson Spineless", workerId: "w5", status: "Active",
      cycle: { sowing: "2026-04-18", planting: "2026-05-01", flowering: "2026-06-12", harvesting: "2026-07-03" } },
    { id: "p6", farmId: "f3", name: "Plot A", sizeAcres: 3, cropId: "c1", variety: "Kulai Red", workerId: "w5", status: "Preparing",
      cycle: { sowing: "2026-08-28", planting: "2026-09-25" } },
    { id: "p7", farmId: "f3", name: "Plot B", sizeAcres: 2, cropId: "c2", variety: "Long Bean 101", workerId: "w2", status: "Fallow",
      cycle: { fallow: "2026-08-20" } },
  ],

  contracts: [
    {
      id: "ct1",
      farmId: "f1",
      landlord: "Haji Ismail",
      monthlyRent: 2400,
      startDate: "2024-09-01",
      endDate: "2026-08-31",
      depositPaid: 4800,
      notes: "2-year lease, renewal to be negotiated",
      paidMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"],
    },
    {
      id: "ct2",
      farmId: "f2",
      landlord: "Lim Estate Sdn Bhd",
      monthlyRent: 1800,
      startDate: "2025-03-01",
      endDate: "2027-02-28",
      depositPaid: 3600,
      paidMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-06", "2026-07"], // May missed
    },
    {
      id: "ct3",
      farmId: "f3",
      landlord: "Pak Samad",
      monthlyRent: 900,
      startDate: "2025-07-01",
      endDate: "2026-06-30",
      depositPaid: 1800,
      notes: "EXPIRED - renewal not signed yet!",
      paidMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"],
    },
  ],

  loans: [
    {
      id: "l1",
      lender: "Maybank SME Loan",
      lenderType: "Bank",
      principal: 150000,
      interestRatePct: 6.5,
      monthlyInstallment: 2934,
      startDate: "2025-01-01",
      tenureMonths: 60,
      paidMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"],
    },
    {
      id: "l2",
      lender: "Uncle Lim",
      lenderType: "Relative",
      principal: 50000,
      interestRatePct: 3,
      monthlyInstallment: 1500,
      startDate: "2025-06-01",
      tenureMonths: 36,
      paidMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-07"], // June missed
      notes: "Flexible but must not miss too many months",
    },
    {
      id: "l3",
      lender: "Ah Chong (friend)",
      lenderType: "Friend",
      principal: 20000,
      interestRatePct: 0,
      monthlyInstallment: 1000,
      startDate: "2026-02-01",
      tenureMonths: 20,
      paidMonths: ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"],
      notes: "Interest-free, pay back within 20 months",
    },
  ],

  projects: [
    {
      id: "pr1",
      farmId: "f3",
      contractor: "Zul Earthworks",
      jobType: "Land Clearing",
      quotedCharge: 18000,
      amountPaid: 18000,
      startDate: "2026-05-05",
      expectedEndDate: "2026-05-25",
      actualEndDate: "2026-06-10",
      status: "Completed",
      notes: "Finished 2 weeks late",
    },
    {
      id: "pr2",
      farmId: "f3",
      contractor: "Pagar Jaya Enterprise",
      jobType: "Fencing",
      quotedCharge: 12500,
      amountPaid: 6000,
      startDate: "2026-06-15",
      expectedEndDate: "2026-07-15",
      status: "Delayed",
      notes: "Only 60% done, chasing contractor weekly",
    },
    {
      id: "pr3",
      farmId: "f3",
      contractor: "Zul Earthworks",
      jobType: "Tilling / Rotovating",
      quotedCharge: 6500,
      amountPaid: 3000,
      startDate: "2026-07-20",
      expectedEndDate: "2026-08-10",
      status: "In Progress",
    },
  ],

  workers: [
    { id: "w1", name: "Worker A (demo)", idNumber: "DEMO-0001", phone: "000-000 0001", nationality: "Myanmar", joinDate: "2025-02-01", baseSalary: 1700, farmId: "f1", active: true },
    { id: "w2", name: "Worker B (demo)", idNumber: "DEMO-0002", phone: "000-000 0002", nationality: "Myanmar", joinDate: "2025-03-15", baseSalary: 1700, farmId: "f1", active: true },
    { id: "w3", name: "Worker C (demo)", idNumber: "DEMO-0003", phone: "000-000 0003", nationality: "Bangladesh", joinDate: "2025-06-01", baseSalary: 1800, farmId: "f1", active: true },
    { id: "w4", name: "Worker D (demo)", idNumber: "DEMO-0004", phone: "000-000 0004", nationality: "Indonesia", joinDate: "2025-08-10", baseSalary: 1750, farmId: "f2", active: true },
    { id: "w5", name: "Worker E (demo)", idNumber: "DEMO-0005", phone: "000-000 0005", nationality: "Indonesia", joinDate: "2026-01-05", baseSalary: 1700, farmId: "f2", active: true },
  ],

  workerExpenses: [
    { id: "we1", workerId: "w1", date: "2026-07-03", type: "Groceries", description: "Rice, oil, eggs", amount: 145, deductFromSalary: true },
    { id: "we2", workerId: "w1", date: "2026-07-10", type: "Phone Top-up", description: "Digi RM30", amount: 30, deductFromSalary: true },
    { id: "we3", workerId: "w1", date: "2026-07-18", type: "Cash Advance", description: "Sent money home", amount: 300, deductFromSalary: true },
    { id: "we4", workerId: "w2", date: "2026-07-05", type: "Cigarettes", description: "2 cartons", amount: 90, deductFromSalary: true },
    { id: "we5", workerId: "w2", date: "2026-07-12", type: "Groceries", description: "Weekly groceries", amount: 120, deductFromSalary: true },
    { id: "we6", workerId: "w3", date: "2026-07-08", type: "Cash Advance", description: "Emergency advance", amount: 500, deductFromSalary: true },
    { id: "we7", workerId: "w3", date: "2026-07-20", type: "Phone Top-up", description: "Hotlink RM50", amount: 50, deductFromSalary: true },
    { id: "we8", workerId: "w4", date: "2026-07-15", type: "Groceries", description: "Groceries + gas tank", amount: 180, deductFromSalary: true },
    { id: "we9", workerId: "w5", date: "2026-07-22", type: "Other", description: "Work boots", amount: 65, deductFromSalary: false },
    { id: "we10", workerId: "w5", date: "2026-07-25", type: "Cash Advance", description: "Advance for Raya", amount: 200, deductFromSalary: true },
  ],

  harvests: [
    // July 2026 (current payroll month)
    { id: "h1", date: "2026-07-02", plotId: "p1", workerId: "w1", cropId: "c1", quantityKg: 420 },
    { id: "h2", date: "2026-07-09", plotId: "p1", workerId: "w1", cropId: "c1", quantityKg: 465 },
    { id: "h3", date: "2026-07-16", plotId: "p1", workerId: "w1", cropId: "c1", quantityKg: 510 },
    { id: "h4", date: "2026-07-23", plotId: "p1", workerId: "w1", cropId: "c1", quantityKg: 480 },
    { id: "h5", date: "2026-07-30", plotId: "p1", workerId: "w1", cropId: "c1", quantityKg: 445 },
    { id: "h6", date: "2026-07-04", plotId: "p2", workerId: "w2", cropId: "c2", quantityKg: 610 },
    { id: "h7", date: "2026-07-11", plotId: "p2", workerId: "w2", cropId: "c2", quantityKg: 655 },
    { id: "h8", date: "2026-07-18", plotId: "p2", workerId: "w2", cropId: "c2", quantityKg: 590 },
    { id: "h9", date: "2026-07-25", plotId: "p2", workerId: "w2", cropId: "c2", quantityKg: 630 },
    { id: "h10", date: "2026-07-08", plotId: "p3", workerId: "w3", cropId: "c1", quantityKg: 380 },
    { id: "h11", date: "2026-07-15", plotId: "p3", workerId: "w3", cropId: "c1", quantityKg: 410 },
    { id: "h12", date: "2026-07-22", plotId: "p3", workerId: "w3", cropId: "c1", quantityKg: 435 },
    { id: "h13", date: "2026-07-29", plotId: "p3", workerId: "w3", cropId: "c1", quantityKg: 460 },
    { id: "h14", date: "2026-07-06", plotId: "p4", workerId: "w4", cropId: "c3", quantityKg: 820 },
    { id: "h15", date: "2026-07-13", plotId: "p4", workerId: "w4", cropId: "c3", quantityKg: 880 },
    { id: "h16", date: "2026-07-20", plotId: "p4", workerId: "w4", cropId: "c3", quantityKg: 790 },
    { id: "h17", date: "2026-07-27", plotId: "p4", workerId: "w4", cropId: "c3", quantityKg: 850 },
    { id: "h18", date: "2026-07-10", plotId: "p5", workerId: "w5", cropId: "c4", quantityKg: 310 },
    { id: "h19", date: "2026-07-17", plotId: "p5", workerId: "w5", cropId: "c4", quantityKg: 340 },
    { id: "h20", date: "2026-07-24", plotId: "p5", workerId: "w5", cropId: "c4", quantityKg: 365 },
    // June 2026
    { id: "h21", date: "2026-06-05", plotId: "p1", workerId: "w1", cropId: "c1", quantityKg: 390 },
    { id: "h22", date: "2026-06-12", plotId: "p1", workerId: "w1", cropId: "c1", quantityKg: 405 },
    { id: "h23", date: "2026-06-19", plotId: "p1", workerId: "w1", cropId: "c1", quantityKg: 430 },
    { id: "h24", date: "2026-06-26", plotId: "p1", workerId: "w1", cropId: "c1", quantityKg: 415 },
    { id: "h25", date: "2026-06-06", plotId: "p2", workerId: "w2", cropId: "c2", quantityKg: 560 },
    { id: "h26", date: "2026-06-13", plotId: "p2", workerId: "w2", cropId: "c2", quantityKg: 585 },
    { id: "h27", date: "2026-06-20", plotId: "p2", workerId: "w2", cropId: "c2", quantityKg: 605 },
    { id: "h28", date: "2026-06-27", plotId: "p2", workerId: "w2", cropId: "c2", quantityKg: 575 },
    { id: "h29", date: "2026-06-10", plotId: "p4", workerId: "w4", cropId: "c3", quantityKg: 760 },
    { id: "h30", date: "2026-06-17", plotId: "p4", workerId: "w4", cropId: "c3", quantityKg: 800 },
    { id: "h31", date: "2026-06-24", plotId: "p4", workerId: "w4", cropId: "c3", quantityKg: 785 },
  ],

  tasks: [
    { id: "t1", date: "2026-08-01", farmId: "f1", plotId: "p1", workerId: "w1", task: "Harvest chili (round 1 of week)", status: "In Progress" },
    { id: "t2", date: "2026-08-01", farmId: "f1", plotId: "p2", workerId: "w2", task: "Weeding + trellis repair", status: "In Progress" },
    { id: "t3", date: "2026-08-01", farmId: "f2", plotId: "p4", workerId: "w4", task: "Harvest cucumber", status: "Planned" },
    { id: "t4", date: "2026-08-02", farmId: "f1", plotId: "p3", workerId: "w3", task: "Spray round - pest control (thrips)", status: "Planned" },
    { id: "t5", date: "2026-08-02", farmId: "f2", plotId: "p5", workerId: "w5", task: "Fertigation NPK", status: "Planned" },
    { id: "t6", date: "2026-08-03", farmId: "f1", plotId: "p1", workerId: "w1", task: "Grading + pack for Ah Seng pickup", status: "Planned" },
    { id: "t7", date: "2026-08-04", farmId: "f3", plotId: "p6", workerId: "w5", task: "Supervise tilling contractor", status: "Planned" },
    { id: "t8", date: "2026-08-05", farmId: "f1", plotId: "p2", workerId: "w2", task: "Harvest long bean", status: "Planned" },
    { id: "t9", date: "2026-08-06", farmId: "f2", plotId: "p4", workerId: "w4", task: "Spray round - downy mildew prevention", status: "Planned" },
    { id: "t10", date: "2026-07-31", farmId: "f1", plotId: "p1", workerId: "w1", task: "Harvest chili", status: "Done" },
    { id: "t11", date: "2026-07-31", farmId: "f2", plotId: "p5", workerId: "w5", task: "Weeding okra rows", status: "Done" },
    { id: "t12", date: "2026-07-30", farmId: "f1", plotId: "p3", workerId: "w3", task: "Harvest chili + grading", status: "Done" },
  ],

  collectors: [
    { id: "cl1", name: "Ah Seng Vegetables (demo)", phone: "000-000 0101", paymentTermDays: 3 },
    { id: "cl2", name: "GreenFresh Trading (demo)", phone: "000-000 0102", paymentTermDays: 7 },
    { id: "cl3", name: "Pasar Borong Selangor (demo)", phone: "000-000 0103", paymentTermDays: 2 },
  ],

  sales: [
    {
      id: "s1", date: "2026-07-24", collectorId: "cl1", cropId: "c1", farmId: "f1",
      grades: [
        { grade: "A", quantityKg: 520, pricePerKg: 6.5 },
        { grade: "B", quantityKg: 260, pricePerKg: 4.8 },
        { grade: "C", quantityKg: 95, pricePerKg: 2.5 },
      ],
      paymentStatus: "Received", paymentReceivedDate: "2026-07-27",
    },
    {
      id: "s2", date: "2026-07-26", collectorId: "cl2", cropId: "c2", farmId: "f1",
      grades: [
        { grade: "A", quantityKg: 780, pricePerKg: 3.2 },
        { grade: "B", quantityKg: 340, pricePerKg: 2.1 },
      ],
      paymentStatus: "Pending",
    },
    {
      id: "s3", date: "2026-07-28", collectorId: "cl3", cropId: "c3", farmId: "f2",
      grades: [
        { grade: "A", quantityKg: 1100, pricePerKg: 1.8 },
        { grade: "B", quantityKg: 520, pricePerKg: 1.2 },
      ],
      paymentStatus: "Pending",
    },
    {
      id: "s4", date: "2026-07-18", collectorId: "cl2", cropId: "c1", farmId: "f1",
      grades: [
        { grade: "A", quantityKg: 430, pricePerKg: 7.0 },
        { grade: "B", quantityKg: 210, pricePerKg: 5.0 },
      ],
      paymentStatus: "Pending", // overdue - term is 7 days
    },
    {
      id: "s5", date: "2026-07-30", collectorId: "cl1", cropId: "c4", farmId: "f2",
      grades: [
        { grade: "A", quantityKg: 290, pricePerKg: 4.2 },
        { grade: "B", quantityKg: 120, pricePerKg: 2.8 },
      ],
      paymentStatus: "Pending",
    },
    {
      id: "s6", date: "2026-06-20", collectorId: "cl1", cropId: "c1", farmId: "f1",
      grades: [
        { grade: "A", quantityKg: 480, pricePerKg: 5.8 },
        { grade: "B", quantityKg: 230, pricePerKg: 4.2 },
        { grade: "C", quantityKg: 80, pricePerKg: 2.2 },
      ],
      paymentStatus: "Received", paymentReceivedDate: "2026-06-23",
    },
    {
      id: "s7", date: "2026-06-25", collectorId: "cl3", cropId: "c3", farmId: "f2",
      grades: [
        { grade: "A", quantityKg: 950, pricePerKg: 2.0 },
        { grade: "B", quantityKg: 400, pricePerKg: 1.3 },
      ],
      paymentStatus: "Received", paymentReceivedDate: "2026-06-27",
    },
    {
      id: "s8", date: "2026-05-15", collectorId: "cl2", cropId: "c2", farmId: "f1",
      grades: [
        { grade: "A", quantityKg: 620, pricePerKg: 2.9 },
        { grade: "B", quantityKg: 280, pricePerKg: 1.9 },
      ],
      paymentStatus: "Received", paymentReceivedDate: "2026-05-21",
    },
    {
      id: "s9", date: "2026-04-22", collectorId: "cl1", cropId: "c1", farmId: "f1",
      grades: [
        { grade: "A", quantityKg: 390, pricePerKg: 6.2 },
        { grade: "B", quantityKg: 180, pricePerKg: 4.5 },
      ],
      paymentStatus: "Received", paymentReceivedDate: "2026-04-25",
    },
    {
      id: "s10", date: "2026-03-30", collectorId: "cl3", cropId: "c1", farmId: "f1",
      grades: [
        { grade: "A", quantityKg: 350, pricePerKg: 5.5 },
        { grade: "B", quantityKg: 160, pricePerKg: 4.0 },
      ],
      paymentStatus: "Received", paymentReceivedDate: "2026-04-01",
    },
  ],

  suppliers: [
    { id: "sp1", name: "Agro Tani Supplies (demo)", phone: "000-000 0201" },
    { id: "sp2", name: "Kim Huat Fertilizer (demo)", phone: "000-000 0202" },
    { id: "sp3", name: "Ladang Mart (demo)", phone: "000-000 0203" },
  ],

  items: [
    {
      id: "i1", name: "NPK 15-15-15", category: "Fertilizer", unit: "bag (50kg)",
      stock: 14, minStock: 10, lastCostPerUnit: 145, trackInventory: true,
      aliases: [
        { supplierId: "sp1", aliasName: "Baja NPK Hijau 15:15:15 50KG" },
        { supplierId: "sp2", aliasName: "KH Compound 15-15-15" },
      ],
    },
    {
      id: "i2", name: "Chicken Manure (processed)", category: "Fertilizer", unit: "bag (25kg)",
      stock: 6, minStock: 20, lastCostPerUnit: 18, trackInventory: true,
      aliases: [
        { supplierId: "sp2", aliasName: "Organic Poultry Compost 25KG" },
        { supplierId: "sp3", aliasName: "Baja Tahi Ayam Proses" },
      ],
    },
    {
      id: "i3", name: "Abamectin 1.8EC (insecticide)", category: "Pesticide", unit: "bottle (1L)",
      stock: 3, minStock: 4, lastCostPerUnit: 68, trackInventory: true,
      aliases: [
        { supplierId: "sp1", aliasName: "Agro-Mectin 1.8 EC 1L" },
        { supplierId: "sp3", aliasName: "Abamektin 18g/L" },
      ],
    },
    {
      id: "i4", name: "Mancozeb 80WP (fungicide)", category: "Fungicide", unit: "pack (1kg)",
      stock: 8, minStock: 5, lastCostPerUnit: 32, trackInventory: true,
      aliases: [
        { supplierId: "sp1", aliasName: "Manzate 80 WP 1KG" },
      ],
    },
    {
      id: "i5", name: "Glyphosate 41% (herbicide)", category: "Herbicide", unit: "bottle (4L)",
      stock: 5, minStock: 3, lastCostPerUnit: 85, trackInventory: true,
      aliases: [
        { supplierId: "sp3", aliasName: "Racun Rumpai Glifosat 41 4L" },
      ],
    },
    {
      id: "i6", name: "Foliar Fertilizer (high K)", category: "Fertilizer", unit: "bottle (1L)",
      stock: 0, minStock: 4, lastCostPerUnit: 42, trackInventory: true,
      aliases: [
        { supplierId: "sp2", aliasName: "KH Foliar Boost K+" },
      ],
    },
    {
      id: "i7", name: "Trellis Netting", category: "Materials", unit: "roll",
      stock: 4, minStock: 2, lastCostPerUnit: 55, trackInventory: true,
      aliases: [{ supplierId: "sp3", aliasName: "Jaring Junjung 100m" }],
    },
    {
      id: "i8", name: "Harvest Crates", category: "Tools", unit: "pcs",
      stock: 38, minStock: 30, lastCostPerUnit: 12, trackInventory: true,
      aliases: [{ supplierId: "sp3", aliasName: "Bakul Plastik Besar" }],
    },
  ],

  purchases: [
    {
      id: "pu1", date: "2026-07-05", supplierId: "sp2", paidBy: "Company",
      lines: [
        { itemId: "i1", invoiceName: "KH Compound 15-15-15", quantity: 10, unitPrice: 145 },
        { itemId: "i6", invoiceName: "KH Foliar Boost K+", quantity: 4, unitPrice: 42 },
      ],
      receiptName: "KH-INV-8842.jpg",
    },
    {
      id: "pu2", date: "2026-07-12", supplierId: "sp1", paidBy: "Own Pocket", claimStatus: "To Claim",
      lines: [
        { itemId: "i3", invoiceName: "Agro-Mectin 1.8 EC 1L", quantity: 2, unitPrice: 68 },
        { itemId: "i4", invoiceName: "Manzate 80 WP 1KG", quantity: 4, unitPrice: 32 },
      ],
      receiptName: "agrotani-receipt.jpg",
      notes: "Paid cash at counter",
    },
    {
      id: "pu3", date: "2026-07-19", supplierId: "sp3", paidBy: "Own Pocket", claimStatus: "Claim Submitted",
      lines: [
        { invoiceName: "Sarung Tangan Getah (12 pairs)", quantity: 1, unitPrice: 38 },
        { itemId: "i8", invoiceName: "Bakul Plastik Besar", quantity: 10, unitPrice: 12 },
      ],
      receiptName: "ladangmart-0719.jpg",
    },
    {
      id: "pu4", date: "2026-06-28", supplierId: "sp2", paidBy: "Own Pocket", claimStatus: "Reimbursed",
      lines: [
        { itemId: "i2", invoiceName: "Organic Poultry Compost 25KG", quantity: 30, unitPrice: 18 },
      ],
      receiptName: "KH-INV-8711.jpg",
    },
  ],

  usageLogs: [
    { id: "u1", date: "2026-07-08", itemId: "i1", quantity: 3, purpose: "Side dressing - Plot A/B", farmId: "f1" },
    { id: "u2", date: "2026-07-15", itemId: "i2", quantity: 12, purpose: "Base fertilizer new beds", farmId: "f3" },
    { id: "u3", date: "2026-07-21", itemId: "i5", quantity: 1, purpose: "Weed control farm paths", farmId: "f2" },
    { id: "u4", date: "2026-07-26", itemId: "i6", quantity: 4, purpose: "Foliar spray chili", farmId: "f1" },
  ],

  applications: [
    {
      id: "a1", date: "2026-07-22", farmId: "f1", plotId: "p1", target: "Pest",
      waterVolumeL: 600,
      products: [
        { itemId: "i3", ratePer100L: 0.05, quantityUsed: 0.3, unitCost: 68 },
        { itemId: "i4", ratePer100L: 0.2, quantityUsed: 1.2, unitCost: 32 },
      ],
      notes: "Thrips + preventive fungicide, mature crop full volume",
    },
    {
      id: "a2", date: "2026-07-26", farmId: "f1", plotId: "p3", target: "Pest",
      waterVolumeL: 300,
      products: [
        { itemId: "i3", ratePer100L: 0.05, quantityUsed: 0.15, unitCost: 68 },
      ],
      notes: "Young crop, half water volume",
    },
    {
      id: "a3", date: "2026-07-28", farmId: "f2", plotId: "p4", target: "Disease",
      waterVolumeL: 500,
      products: [
        { itemId: "i4", ratePer100L: 0.25, quantityUsed: 1.25, unitCost: 32 },
        { itemId: "i6", ratePer100L: 0.3, quantityUsed: 1.5, unitCost: 42 },
      ],
      notes: "Downy mildew + foliar feed combo",
    },
    {
      id: "a4", date: "2026-07-30", farmId: "f2", plotId: "p5", target: "Weed",
      waterVolumeL: 200,
      products: [
        { itemId: "i5", ratePer100L: 1.0, quantityUsed: 2, unitCost: 21.25 },
      ],
      notes: "Inter-row weed control",
    },
  ],
};
