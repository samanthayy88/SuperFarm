"use client";

import { useState } from "react";
import { useStore, newId } from "@/lib/store";
import { PageHeader, Card, Table, Th, Td, Button, Modal, Field, TextInput, Select, StatCard, Tabs, EmptyState, ConfirmDialog } from "@/components/ui";
import { fmtRM, fmtDate, todayLocalISO } from "@/lib/utils";
import { AbBatch, AbDistribution, AbPart, AbRecipeLine, AbUse, DB, InventoryItem } from "@/lib/types";
import { consumeStock, mainBalance } from "@/lib/stock";
import {
  AB_KG_PER_PART,
  abUseCost,
  costPerSet,
  farmSets,
  fmtAmount,
  mainSets,
  setsDistributed,
  setsProduced,
  setsUsed,
  syncAbItem,
  toBase,
  unitChoices,
  weightKg,
} from "@/lib/ab";

const r3 = (n: number) => Number(n.toFixed(3));

/** `update` for the AB lists that also re-syncs the AB Fertilizers stock item. */
function useAbUpdate(setDB: (fn: (prev: DB) => DB) => void) {
  return <K extends "abDistributions" | "abUses">(key: K, fn: (list: DB[K]) => DB[K]) =>
    setDB((prev) => syncAbItem({ ...prev, [key]: fn(prev[key]) }));
}

/** Products an AB mix can be made from: everything under Expense Category "Fertilizer" except AB Fertilizers itself. */
function ingredientItems(db: DB): InventoryItem[] {
  return db.items.filter((i) => i.category === "Fertilizer" && i.name.trim().toLowerCase() !== "ab fertilizers");
}

// ---------- draft recipe lines (amount typed in a unit the user picks) ----------
interface DraftLine {
  key: string;
  itemId: string;
  amount: string;
  unit: string;
}

function toDraft(db: DB, l: AbRecipeLine): DraftLine {
  const item = db.items.find((i) => i.id === l.itemId);
  const base = item?.unit ?? "kg";
  // show small kg / L amounts as g / mL so "10 g" is not typed as 0.01
  if ((base === "kg" || base === "L") && l.quantity < 1) {
    return { key: newId("l"), itemId: l.itemId, amount: String(r3(l.quantity * 1000)), unit: base === "kg" ? "g" : "mL" };
  }
  return { key: newId("l"), itemId: l.itemId, amount: String(l.quantity), unit: base };
}

function draftQty(db: DB, l: DraftLine): number {
  const item = db.items.find((i) => i.id === l.itemId);
  const n = Number(l.amount);
  if (!item || !(n > 0)) return 0;
  return toBase(n, l.unit, item.unit) ?? 0;
}

function toLines(db: DB, ds: DraftLine[]): AbRecipeLine[] {
  return ds.map((d) => ({ itemId: d.itemId, quantity: r3(draftQty(db, d)) })).filter((l) => l.itemId && l.quantity > 0);
}

function draftKg(db: DB, ds: DraftLine[]): number {
  return weightKg(
    toLines(db, ds).map((l) => ({ qty: l.quantity, unit: db.items.find((i) => i.id === l.itemId)?.unit ?? "kg" }))
  );
}

/** Add / edit the products of one part (A or B) and how much of each goes into ONE set. */
function PartEditor({ db, part, lines, onChange }: { db: DB; part: AbPart; lines: DraftLine[]; onChange: (l: DraftLine[]) => void }) {
  const items = ingredientItems(db);
  const set = (key: string, patch: Partial<DraftLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const kg = draftKg(db, lines);
  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Fertilizer {part} — amount per set</span>
        <span className="text-xs text-muted">
          {lines.length > 0 ? `${kg.toLocaleString()} kg of ${AB_KG_PER_PART} kg` : ""}
        </span>
      </div>
      {lines.length === 0 && <p className="mb-2 text-xs text-muted">No products yet.</p>}
      <div className="space-y-2">
        {lines.map((l) => {
          const item = db.items.find((i) => i.id === l.itemId);
          return (
            <div key={l.key} className="grid grid-cols-[1fr_5rem_4.5rem_auto] items-center gap-2">
              <Select
                value={l.itemId}
                onChange={(e) => {
                  const it = db.items.find((i) => i.id === e.target.value);
                  set(l.key, { itemId: e.target.value, unit: it?.unit ?? l.unit });
                }}
              >
                <option value="">— choose product —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </Select>
              <TextInput type="number" step="any" value={l.amount} onChange={(e) => set(l.key, { amount: e.target.value })} placeholder="Amount" />
              <Select value={l.unit} onChange={(e) => set(l.key, { unit: e.target.value })}>
                {unitChoices(item?.unit ?? l.unit).map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
              <button onClick={() => onChange(lines.filter((x) => x.key !== l.key))} className="px-2 text-muted hover:text-critical" aria-label="Remove product">
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-2">
        <Button variant="ghost" small onClick={() => onChange([...lines, { key: newId("l"), itemId: "", amount: "", unit: "kg" }])}>
          + Add product
        </Button>
      </div>
    </div>
  );
}

export default function AbFertilizersPage() {
  const { db, setDB } = useStore();
  /** Change one AB list, then keep the AB Fertilizers stock item in step. */
  const update = useAbUpdate(setDB);
  const [tab, setTab] = useState("Batches");
  const [modal, setModal] = useState<"batch" | "distribute" | "use" | "recipe" | null>(null);
  const [del, setDel] = useState<{ kind: "batch" | "dist" | "use"; id: string } | null>(null);

  const produced = setsProduced(db);
  const main = mainSets(db);
  const withFarms = r3(setsDistributed(db) - setsUsed(db));
  const used = setsUsed(db);
  const usedCost = db.abUses.reduce((s, u) => s + abUseCost(db, u), 0);
  const batches = [...db.abBatches].sort((a, b) => b.date.localeCompare(a.date));
  const farmName = (id: string) => db.farms.find((f) => f.id === id)?.name ?? "—";
  const itemName = (id: string) => db.items.find((i) => i.id === id)?.name ?? "(deleted product)";
  const itemUnit = (id: string) => db.items.find((i) => i.id === id)?.unit ?? "";
  const hasRecipe = db.abRecipe.A.length + db.abRecipe.B.length > 0;

  /** Deleting a batch is only allowed while the sets it made are still unissued; its ingredients go back to stock. */
  const removeBatch = (b: AbBatch) => {
    setDB((prev) =>
      syncAbItem({
        ...prev,
        abBatches: prev.abBatches.filter((x) => x.id !== b.id),
        items: prev.items.map((i) => {
          const back = b.lines.filter((l) => l.itemId === i.id).reduce((s, l) => s + l.perSet * b.sets, 0);
          return back > 0 ? { ...i, stock: r3(i.stock + back) } : i;
        }),
      })
    );
  };
  const batchCanGo = (b: AbBatch) => r3(produced - b.sets) >= setsDistributed(db);
  const distCanGo = (d: AbDistribution) => farmSets(db, d.farmId) - d.sets >= -1e-9;

  return (
    <div>
      <PageHeader
        title="AB Fertilizers"
        subtitle="Mix Fertilizer A and B from your Fertilizer products (one set = 10 kg of A + 10 kg of B), hand sets to farms, and record what is used. The cost only reaches costing when a set is used."
        actions={
          <>
            <Button variant="ghost" onClick={() => setModal("recipe")}>Standard recipe</Button>
            <Button variant="ghost" onClick={() => setModal("use")}>− Record use</Button>
            <Button variant="ghost" onClick={() => setModal("distribute")}>Distribute to farm</Button>
            <Button onClick={() => setModal("batch")}>+ Produce batch</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Sets produced" value={produced.toLocaleString()} sub={`${db.abBatches.length} batch(es)`} />
        <StatCard label="In AB store" value={main.toLocaleString()} sub="not yet given to a farm" />
        <StatCard label="With farms" value={withFarms.toLocaleString()} sub="given, not yet used" />
        <StatCard label="Sets used" value={used.toLocaleString()} sub={`Cost ${fmtRM(usedCost)}`} />
        <StatCard label="Average cost / set" value={fmtRM(costPerSet(db))} sub="from ingredients used" />
      </div>

      <Tabs tabs={["Batches", "By Farm", "Distributions", "Used"]} active={tab} onChange={setTab} />

      {tab === "Batches" && (
        <Card title="Production batches">
          {batches.length === 0 ? (
            <EmptyState message={hasRecipe ? "No batch produced yet. Use “+ Produce batch”." : "Set the standard recipe first, then produce your first batch."} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date made</Th>
                  <Th right>Sets</Th>
                  <Th>Ingredients used (whole batch)</Th>
                  <Th right>Cost</Th>
                  <Th right>Cost / set</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="align-top">
                    <Td>{fmtDate(b.date)}{b.note ? <div className="text-xs text-muted">{b.note}</div> : null}</Td>
                    <Td right>{b.sets.toLocaleString()}</Td>
                    <Td>
                      {(["A", "B"] as AbPart[]).map((p) => (
                        <div key={p} className="text-xs text-ink-2">
                          <span className="font-medium text-ink">{p}:</span>{" "}
                          {b.lines
                            .filter((l) => l.part === p)
                            .map((l) => `${itemName(l.itemId)} ${fmtAmount(l.perSet * b.sets, itemUnit(l.itemId))}`)
                            .join(", ") || "—"}
                        </div>
                      ))}
                    </Td>
                    <Td right>{fmtRM(b.totalCost)}</Td>
                    <Td right>{fmtRM(b.sets > 0 ? b.totalCost / b.sets : 0)}</Td>
                    <Td right>
                      {batchCanGo(b) ? (
                        <button onClick={() => setDel({ kind: "batch", id: b.id })} className="text-xs text-critical hover:underline">Delete</button>
                      ) : (
                        <span className="text-xs text-muted" title="Some of these sets are already with farms">Locked</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "By Farm" && (
        <Card title="Sets by farm">
          <Table>
            <thead>
              <tr>
                <Th>Farm</Th>
                <Th right>Given</Th>
                <Th right>Used</Th>
                <Th right>Left</Th>
                <Th right>Cost of sets used</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>AB store (not given out)</Td>
                <Td right>—</Td>
                <Td right>—</Td>
                <Td right>{main.toLocaleString()}</Td>
                <Td right>—</Td>
              </tr>
              {db.farms.map((f) => (
                <tr key={f.id}>
                  <Td>{f.name}</Td>
                  <Td right>{setsDistributed(db, f.id).toLocaleString()}</Td>
                  <Td right>{setsUsed(db, f.id).toLocaleString()}</Td>
                  <Td right>{farmSets(db, f.id).toLocaleString()}</Td>
                  <Td right>{fmtRM(db.abUses.filter((u) => u.farmId === f.id).reduce((s, u) => s + abUseCost(db, u), 0))}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === "Distributions" && (
        <Card title="Sets given to farms">
          {db.abDistributions.length === 0 ? (
            <EmptyState message="Nothing given to a farm yet." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Farm</Th>
                  <Th right>Sets</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {[...db.abDistributions].sort((a, b) => b.date.localeCompare(a.date)).map((d) => (
                  <tr key={d.id}>
                    <Td>{fmtDate(d.date)}</Td>
                    <Td>{farmName(d.farmId)}</Td>
                    <Td right>{d.sets.toLocaleString()}</Td>
                    <Td right>
                      {distCanGo(d) ? (
                        <button onClick={() => setDel({ kind: "dist", id: d.id })} className="text-xs text-critical hover:underline">Delete</button>
                      ) : (
                        <span className="text-xs text-muted" title="The farm has already used these sets">Locked</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "Used" && (
        <Card title="Sets used — this is what is charged to costing">
          {db.abUses.length === 0 ? (
            <EmptyState message="No set used yet, so nothing is charged to costing." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Farm</Th>
                  <Th>Plot · Crop</Th>
                  <Th right>Sets</Th>
                  <Th right>Cost</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {[...db.abUses].sort((a, b) => b.date.localeCompare(a.date)).map((u) => (
                  <tr key={u.id}>
                    <Td>{fmtDate(u.date)}{u.note ? <div className="text-xs text-muted">{u.note}</div> : null}</Td>
                    <Td>{farmName(u.farmId)}</Td>
                    <Td>
                      {db.plots.find((p) => p.id === u.plotId)?.name ?? "—"} · {db.crops.find((c) => c.id === u.cropId)?.name ?? "—"}
                    </Td>
                    <Td right>{u.sets.toLocaleString()}</Td>
                    <Td right>{fmtRM(abUseCost(db, u))}</Td>
                    <Td right>
                      <button onClick={() => setDel({ kind: "use", id: u.id })} className="text-xs text-critical hover:underline">Delete</button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {modal === "recipe" && <RecipeForm onClose={() => setModal(null)} />}
      {modal === "batch" && <BatchForm onClose={() => setModal(null)} />}
      {modal === "distribute" && <DistributeForm onClose={() => setModal(null)} />}
      {modal === "use" && <UseForm onClose={() => setModal(null)} />}

      {del && (() => {
        const close = () => setDel(null);
        if (del.kind === "batch") {
          const b = db.abBatches.find((x) => x.id === del.id);
          if (!b) return null;
          return (
            <ConfirmDialog
              title="Delete this batch?"
              message={`${b.sets} set(s) made on ${fmtDate(b.date)} will be removed and the ingredients put back into Main stock.`}
              confirmLabel="Delete batch"
              onClose={close}
              onConfirm={() => {
                removeBatch(b);
                close();
              }}
            />
          );
        }
        if (del.kind === "dist") {
          return (
            <ConfirmDialog
              title="Delete this distribution?"
              message="The sets go back to the AB store."
              confirmLabel="Delete"
              onClose={close}
              onConfirm={() => {
                update("abDistributions", (l) => l.filter((x) => x.id !== del.id));
                close();
              }}
            />
          );
        }
        return (
          <ConfirmDialog
            title="Delete this usage record?"
            message="The sets go back to the farm and the cost is removed from costing."
            confirmLabel="Delete"
            onClose={close}
            onConfirm={() => {
              update("abUses", (l) => l.filter((x) => x.id !== del.id));
              close();
            }}
          />
        );
      })()}
    </div>
  );
}

// ---------------- Standard recipe ----------------
function RecipeForm({ onClose }: { onClose: () => void }) {
  const { db, update } = useStore();
  const [a, setA] = useState<DraftLine[]>(() => db.abRecipe.A.map((l) => toDraft(db, l)));
  const [b, setB] = useState<DraftLine[]>(() => db.abRecipe.B.map((l) => toDraft(db, l)));
  const save = () => {
    update("abRecipe", () => ({ A: toLines(db, a), B: toLines(db, b) }));
    onClose();
  };
  return (
    <Modal title="Standard recipe (per set)" onClose={onClose} wide>
      <div className="space-y-3">
        <p className="text-xs text-muted">
          How much of each Fertilizer product goes into ONE set (10 kg of A + 10 kg of B). Each new batch starts from this and you can adjust it for
          that batch. Past batches are not changed.
        </p>
        <PartEditor db={db} part="A" lines={a} onChange={setA} />
        <PartEditor db={db} part="B" lines={b} onChange={setB} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save recipe</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Produce a batch ----------------
function BatchForm({ onClose }: { onClose: () => void }) {
  const { db, setDB } = useStore();
  const [date, setDate] = useState(todayLocalISO());
  const [sets, setSets] = useState("1");
  const [note, setNote] = useState("");
  const [a, setA] = useState<DraftLine[]>(() => db.abRecipe.A.map((l) => toDraft(db, l)));
  const [b, setB] = useState<DraftLine[]>(() => db.abRecipe.B.map((l) => toDraft(db, l)));
  const n = Number(sets) || 0;

  const lines = [
    ...toLines(db, a).map((l) => ({ part: "A" as AbPart, ...l })),
    ...toLines(db, b).map((l) => ({ part: "B" as AbPart, ...l })),
  ];
  // total needed per product across A and B, against what Main holds
  const need = new Map<string, number>();
  for (const l of lines) need.set(l.itemId, (need.get(l.itemId) ?? 0) + l.quantity * n);
  const short = [...need.entries()]
    .map(([id, q]) => ({ item: db.items.find((i) => i.id === id), q }))
    .filter((x) => x.item && x.q > mainBalance(x.item) + 1e-9);
  const cost = lines.reduce((s, l) => s + l.quantity * n * (db.items.find((i) => i.id === l.itemId)?.lastCostPerUnit ?? 0), 0);
  const valid = n > 0 && lines.length > 0 && short.length === 0 && Boolean(date);

  const save = () => {
    if (!valid) return;
    const batch: AbBatch = {
      id: newId("abb"),
      date,
      sets: n,
      lines: lines.map((l) => ({
        part: l.part,
        itemId: l.itemId,
        perSet: l.quantity,
        unitCost: db.items.find((i) => i.id === l.itemId)?.lastCostPerUnit ?? 0,
      })),
      totalCost: Number(cost.toFixed(2)),
      note: note.trim() || undefined,
    };
    setDB((prev) =>
      syncAbItem({
        ...prev,
        abBatches: [...prev.abBatches, batch],
        items: prev.items.map((i) => (need.has(i.id) ? consumeStock(i, undefined, need.get(i.id) ?? 0) : i)),
      })
    );
    onClose();
  };

  return (
    <Modal title="Produce a batch" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date produced">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Total sets produced">
            <TextInput type="number" step="any" value={sets} onChange={(e) => setSets(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-muted">Amounts below are per ONE set. Change them if this batch was mixed differently from the standard recipe.</p>
        <PartEditor db={db} part="A" lines={a} onChange={setA} />
        <PartEditor db={db} part="B" lines={b} onChange={setB} />
        <Field label="Note (optional)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. changed the potassium rate" />
        </Field>
        {lines.length > 0 && n > 0 && (
          <div className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
            <div className="font-medium text-ink">Taken from Main stock for {n} set(s):</div>
            {[...need.entries()].map(([id, q]) => {
              const it = db.items.find((i) => i.id === id);
              return (
                <div key={id} className={it && q > mainBalance(it) + 1e-9 ? "text-critical" : ""}>
                  {itemName(db, id)} — {fmtAmount(q, it?.unit ?? "")} (Main has {fmtAmount(it ? mainBalance(it) : 0, it?.unit ?? "")})
                </div>
              );
            })}
            <div className="mt-1 text-ink">
              Batch cost {fmtRM(cost)} · {fmtRM(cost / n)} per set (at each product&apos;s last purchase price)
            </div>
          </div>
        )}
        {short.length > 0 && <p className="text-xs text-critical">Not enough Main stock for some products. Buy more under Purchases or lower the amounts.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save batch</Button>
        </div>
      </div>
    </Modal>
  );
}

function itemName(db: DB, id: string) {
  return db.items.find((i) => i.id === id)?.name ?? "(deleted product)";
}

// ---------------- Distribute to a farm ----------------
function DistributeForm({ onClose }: { onClose: () => void }) {
  const { db, setDB } = useStore();
  const update = useAbUpdate(setDB);
  const [date, setDate] = useState(todayLocalISO());
  const [farmId, setFarmId] = useState(db.farms[0]?.id ?? "");
  const [sets, setSets] = useState("");
  const n = Number(sets) || 0;
  const avail = mainSets(db);
  const valid = n > 0 && n <= avail + 1e-9 && Boolean(farmId);
  const save = () => {
    if (!valid) return;
    const d: AbDistribution = { id: newId("abd"), date, farmId, sets: n };
    update("abDistributions", (l) => [...l, d]);
    onClose();
  };
  return (
    <Modal title="Distribute sets to a farm" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Farm">
          <Select value={farmId} onChange={(e) => setFarmId(e.target.value)}>
            {db.farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sets to give">
          <TextInput type="number" step="any" value={sets} onChange={(e) => setSets(e.target.value)} />
        </Field>
        <p className={`text-xs ${n > avail + 1e-9 ? "text-critical" : "text-muted"}`}>
          {avail.toLocaleString()} set(s) in the AB store. Giving sets to a farm does not cost it anything yet — only use does.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Give to farm</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Record use ----------------
function UseForm({ onClose }: { onClose: () => void }) {
  const { db, setDB } = useStore();
  const update = useAbUpdate(setDB);
  const [date, setDate] = useState(todayLocalISO());
  const [farmId, setFarmId] = useState(db.farms[0]?.id ?? "");
  const plots = db.plots.filter((p) => p.farmId === farmId);
  const [plotId, setPlotId] = useState(plots[0]?.id ?? "");
  const [sets, setSets] = useState("");
  const [note, setNote] = useState("");
  const n = Number(sets) || 0;
  const avail = farmSets(db, farmId);
  const plot = db.plots.find((p) => p.id === plotId);
  const valid = n > 0 && n <= avail + 1e-9 && Boolean(plot);
  const save = () => {
    if (!valid || !plot) return;
    const u: AbUse = { id: newId("abu"), date, farmId, plotId: plot.id, cropId: plot.cropId, sets: n, note: note.trim() || undefined };
    update("abUses", (l) => [...l, u]);
    onClose();
  };
  return (
    <Modal title="Record sets used" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Date used">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Farm">
          <Select
            value={farmId}
            onChange={(e) => {
              setFarmId(e.target.value);
              setPlotId(db.plots.find((p) => p.farmId === e.target.value)?.id ?? "");
            }}
          >
            {db.farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Plot (its crop is charged)">
          <Select value={plotId} onChange={(e) => setPlotId(e.target.value)}>
            {plots.length === 0 && <option value="">No plots on this farm</option>}
            {plots.map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {db.crops.find((c) => c.id === p.cropId)?.name ?? "—"}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sets used">
          <TextInput type="number" step="any" value={sets} onChange={(e) => setSets(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className={`text-xs ${n > avail + 1e-9 ? "text-critical" : "text-muted"}`}>
          {farmName(db, farmId)} has {avail.toLocaleString()} set(s) left.
          {n > 0 && n <= avail + 1e-9 ? ` This charges about ${fmtRM(n * costPerSet(db, date))} to ${plot ? plot.name : "the plot"}.` : ""}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

function farmName(db: DB, id: string) {
  return db.farms.find((f) => f.id === id)?.name ?? "—";
}
