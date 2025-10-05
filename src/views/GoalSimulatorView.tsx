import { useMemo, useState, type FormEvent } from 'react';
import { addYears, formatISO } from 'date-fns';
import { useFinancialStore } from '../store/FinancialStoreProvider';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function GoalSimulatorView() {
  const { goals, categories } = useFinancialStore();
  const [assumptions, setAssumptions] = useState({ expectedReturn: 0.11, inflation: 0.06 });
  const [simulatedGoal, setSimulatedGoal] = useState(() => goals[0] ?? null);

  const simulation = useMemo(() => {
    if (!simulatedGoal) return null;
    const years = Math.max(1, new Date(simulatedGoal.targetDate).getFullYear() - new Date().getFullYear());
    const futureValue = simulatedGoal.targetAmount * (1 + assumptions.inflation) ** years;
    const requiredMonthlyRate = (futureValue - simulatedGoal.currentAmount) / (years * 12);
    const adjustedForReturns = requiredMonthlyRate / (assumptions.expectedReturn / 12);

    return {
      goal: simulatedGoal,
      years,
      futureValue,
      requiredMonthlyRate,
      adjustedForReturns
    };
  }, [simulatedGoal, assumptions]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Goal Planning & What-if Simulation</h2>
        <p className="text-sm text-slate-400">
          Stress-test your financial goals, link them to categories, and understand the path to funding.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase text-slate-500">Goal</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={simulatedGoal?.id ?? ''}
                onChange={(event) =>
                  setSimulatedGoal(goals.find((goal) => goal.id === event.target.value) ?? null)
                }
              >
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase text-slate-500">Expected annual return</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={assumptions.expectedReturn}
                onChange={(event) => setAssumptions((prev) => ({ ...prev, expectedReturn: Number(event.target.value) }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase text-slate-500">Inflation</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={assumptions.inflation}
                onChange={(event) => setAssumptions((prev) => ({ ...prev, inflation: Number(event.target.value) }))}
              />
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 sm:p-6">
            {simulation ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-100">{simulation.goal.name}</h3>
                <p className="text-sm text-slate-400">
                  Linked category: {categories.find((cat) => cat.id === simulation.goal.categoryId)?.name ?? 'Uncategorised'}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Stat label="Current corpus" value={formatCurrency(simulation.goal.currentAmount)} />
                  <Stat label="Inflation adjusted target" value={formatCurrency(simulation.futureValue)} />
                  <Stat label="Required monthly contribution" value={formatCurrency(simulation.requiredMonthlyRate)} />
                  <Stat
                    label="Monthly SIP with returns"
                    value={formatCurrency(Math.max(simulation.adjustedForReturns, 0))}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Create a goal to begin simulations.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <h3 className="text-lg font-semibold">Create new goal</h3>
        <GoalCreator />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-accent">{value}</p>
    </div>
  );
}

function GoalCreator() {
  const { addCategory, addPlannedExpense, addGoal } = useFinancialStore();
  const [form, setForm] = useState({
    name: '',
    amount: 500000,
    targetDate: formatISO(addYears(new Date(), 2), { representation: 'date' }),
    categoryName: 'New Goal Category'
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const category = await addCategory({ name: form.categoryName, type: 'asset', isCustom: true });
    await addGoal({
      name: form.name,
      targetAmount: form.amount,
      currentAmount: 0,
      targetDate: form.targetDate,
      categoryId: category.id
    });
    await addPlannedExpense({
      name: `${form.name} contributions`,
      plannedAmount: form.amount / 12,
      categoryId: category.id,
      dueDate: form.targetDate,
      priority: 'medium',
      status: 'pending'
    });
    setForm((prev) => ({ ...prev, name: '', amount: 0 }));
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <label className="text-xs uppercase text-slate-500">Goal name</label>
        <input
          required
          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs uppercase text-slate-500">Target amount (₹)</label>
        <input
          type="number"
          min={0}
          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
          value={form.amount}
          onChange={(event) => setForm((prev) => ({ ...prev, amount: Number(event.target.value) }))}
        />
      </div>
      <div>
        <label className="text-xs uppercase text-slate-500">Target date</label>
        <input
          type="date"
          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
          value={form.targetDate}
          onChange={(event) => setForm((prev) => ({ ...prev, targetDate: event.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs uppercase text-slate-500">Linked category name</label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
          value={form.categoryName}
          onChange={(event) => setForm((prev) => ({ ...prev, categoryName: event.target.value }))}
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-lg bg-success px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 md:col-span-2 md:w-auto"
      >
        Simulate goal funding
      </button>
    </form>
  );
}
