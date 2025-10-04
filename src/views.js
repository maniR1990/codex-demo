import {
  formatCurrency,
  formatDate,
  formatMonth,
  formatNumber,
  formatPercent,
  clamp,
  sum,
  average,
  median,
  standardDeviation
} from './utils.js';

const viewDefinitions = {
  dashboard(state) {
    const { metrics, transactions, categories, cashflowTrend, wealthAccelerator } = state;
    const topSpending = [...categories]
      .filter((category) => category.type === 'expense')
      .map((category) => ({
        category,
        total: Math.abs(
          sum(state.transactions.filter((txn) => txn.categoryId === category.id && txn.amount < 0).map((txn) => txn.amount))
        )
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const recentTransactions = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);

    return `
      <section class="grid-metrics">
        ${metricCard('Total Net Worth', formatCurrency(metrics.netWorth), 'Assets – Liabilities')}
        ${metricCard('Liquid Assets', formatCurrency(metrics.assets), 'Cash, deposits, and investments')}
        ${metricCard('Monthly Income', formatCurrency(metrics.income), 'Imported and manual inflows')}
        ${metricCard('Monthly Expenses', formatCurrency(metrics.expenses), 'Spends tracked across sources')}
      </section>
      <section class="section-grid two">
        <div class="panel">
          <div class="panel-header">
            <h2>Savings & Investment Rate</h2>
            <p>Capital deployment efficiency based on this month’s cash flow.</p>
          </div>
          ${radialGauge(metrics.savingsRate)}
          <div class="chip-list">
            <span class="chip">Income: ${formatCurrency(metrics.income)}</span>
            <span class="chip">Expenses: ${formatCurrency(metrics.expenses)}</span>
            <span class="chip">Savings: ${formatCurrency(metrics.income - metrics.expenses)}</span>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <h2>Top Spending Categories</h2>
            <p>Identify heavy outflows and target optimisation opportunities.</p>
          </div>
          <div class="card-list">
            ${
              topSpending.length
                ? topSpending
                    .map(
                      (item) => `
                        <div class="list-tile">
                          <div>
                            <strong>${item.category.name}</strong>
                            <div class="progress">
                              <span style="width:${clamp((item.total / Math.max(metrics.expenses, 1)) * 100, 2, 100)}%"></span>
                            </div>
                          </div>
                          <div class="badge negative">${formatCurrency(Math.abs(item.total))}</div>
                        </div>
                      `
                    )
                    .join('')
                : `<p class="empty-state">No expense activity yet.</p>`
            }
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Cash Flow Trend</h2>
          <p>Track month-on-month income versus expenses with variance insights.</p>
        </div>
        ${lineChart(cashflowTrend)}
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Recent Transactions</h2>
          <p>Latest synced and manual entries across your financial institutions.</p>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${
                recentTransactions.length
                  ? recentTransactions
                      .map((txn) => {
                        const category = categories.find((cat) => cat.id === txn.categoryId);
                        return `
                          <tr>
                            <td>${formatDate(txn.date)}</td>
                            <td>${txn.description}</td>
                            <td>${category ? category.name : 'Uncategorised'}</td>
                            <td style="text-align:right" class="${txn.amount < 0 ? 'negative' : 'positive'}">${formatCurrency(
                          txn.amount
                        )}</td>
                          </tr>
                        `;
                      })
                      .join('')
                  : '<tr><td colspan="4" class="empty-state">No transactions recorded.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Wealth Accelerator Signals</h2>
          <p>Premium intelligence summarised for quick executive decisions.</p>
        </div>
        <div class="card-list three">
          <div class="metric-card">
            <span class="label">Capital Efficiency Score</span>
            <span class="value">${wealthAccelerator.capitalEfficiencyScore}</span>
            <span class="subtle">Target ≥ 65 for fast-track outcomes.</span>
          </div>
          <div class="metric-card">
            <span class="label">Runway</span>
            <span class="value">${metrics.runwayMonths === Infinity ? '∞' : formatNumber(metrics.runwayMonths)} months</span>
            <span class="subtle">Liquid asset coverage of expense run-rate.</span>
          </div>
          <div class="metric-card">
            <span class="label">Protection Gap</span>
            <span class="value">${formatCurrency(wealthAccelerator.protectionGap)}</span>
            <span class="subtle">Additional coverage recommended.</span>
          </div>
        </div>
        <div class="chip-list">
          ${wealthAccelerator.opportunityCostAlerts.map((alert) => `<span class="chip">${alert}</span>`).join('')}
        </div>
      </section>
    `;
  },
  balanceSheet(state) {
    const assetTypes = ['bank', 'investment', 'cash', 'property', 'other-asset'];
    const liabilityTypes = ['loan', 'credit-card', 'other-liability'];
    const assets = state.accounts.filter((account) => assetTypes.includes(account.type));
    const liabilities = state.accounts.filter((account) => liabilityTypes.includes(account.type));

    const renderList = (items) =>
      items
        .map(
          (item) => `
            <div class="list-tile">
              <div>
                <strong>${item.name}</strong>
                <small>${item.institution}</small>
              </div>
              <div class="badge ${item.balance >= 0 ? 'positive' : 'negative'}">${formatCurrency(item.balance)}</div>
            </div>
          `
        )
        .join('');

    return `
      <section class="section-grid two">
        <div class="panel">
          <div class="panel-header">
            <h2>Assets</h2>
            <p>Total ${formatCurrency(sum(assets.map((asset) => asset.balance)))} across all holdings.</p>
          </div>
          <div class="card-list">
            ${assets.length ? renderList(assets) : '<p class="empty-state">Add bank, investment, or property accounts.</p>'}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <h2>Liabilities</h2>
            <p>Total ${formatCurrency(sum(liabilities.map((item) => item.balance)))} across commitments.</p>
          </div>
          <div class="card-list">
            ${
              liabilities.length
                ? renderList(liabilities)
                : '<p class="empty-state">No loans or credit facilities recorded.</p>'
            }
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Add Account</h2>
          <p>Manual entry for assets or liabilities not synced via aggregation.</p>
        </div>
        <form data-action="add-account">
          <div class="inline-field">
            <label for="account-name">Account name <span class="required">*</span></label>
            <input id="account-name" name="name" required placeholder="Account label" />
          </div>
          <div class="inline-field">
            <label for="account-institution">Institution</label>
            <input id="account-institution" name="institution" placeholder="Institution or provider" />
          </div>
          <div class="inline-field">
            <label for="account-type">Type</label>
            <select id="account-type" name="type">
              <option value="bank">Bank / Cash</option>
              <option value="investment">Investment</option>
              <option value="property">Property</option>
              <option value="other-asset">Other asset</option>
              <option value="loan">Loan</option>
              <option value="credit-card">Credit card</option>
              <option value="other-liability">Other liability</option>
            </select>
          </div>
          <div class="inline-field">
            <label for="account-balance">Balance</label>
            <input id="account-balance" name="balance" type="number" step="0.01" value="0" />
          </div>
          <div class="button-row">
            <button class="button" type="submit">Add account</button>
          </div>
        </form>
      </section>
    `;
  },
  trend(state) {
    const { cashflowTrend, transactions, categories } = state;
    const incomeSeries = cashflowTrend.map((row) => row.income);
    const expenseSeries = cashflowTrend.map((row) => row.expense);
    const netSeries = cashflowTrend.map((row) => row.net);

    const averageSpend = average(expenseSeries);
    const medianSpend = median(expenseSeries);
    const volatility = standardDeviation(expenseSeries);

    const customCategoryTotals = categories
      .filter((cat) => cat.isCustom)
      .map((category) => ({
        category,
        total: sum(
          transactions
            .filter((txn) => txn.categoryId === category.id && txn.amount < 0)
            .map((txn) => Math.abs(txn.amount))
        )
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    return `
      <section class="panel">
        <div class="panel-header">
          <h2>Monthly Trend Analysis</h2>
          <p>Compare monthly spending with long-term averages to detect anomalies.</p>
        </div>
        ${lineChart(cashflowTrend)}
        <div class="chip-list">
          <span class="chip">Average spend: ${formatCurrency(averageSpend)}</span>
          <span class="chip">Median spend: ${formatCurrency(medianSpend)}</span>
          <span class="chip">Volatility: ${formatCurrency(volatility)}</span>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Custom Categories</h2>
          <p>Spotlight spending grouped by your bespoke classification.</p>
        </div>
        <div class="card-list">
          ${
            customCategoryTotals.length
              ? customCategoryTotals
                  .map(
                    (item) => `
                      <div class="list-tile">
                        <div>
                          <strong>${item.category.name}</strong>
                          <small>${item.category.type === 'income' ? 'Income' : 'Expense'} category</small>
                        </div>
                        <span class="badge ${item.category.type === 'income' ? 'positive' : 'negative'}">
                          ${formatCurrency(item.total)}
                        </span>
                      </div>
                    `
                  )
                  .join('')
              : '<p class="empty-state">No custom categories with activity yet.</p>'
          }
        </div>
        <hr />
        <form data-action="add-category">
          <div class="inline-field">
            <label for="category-name">Name <span class="required">*</span></label>
            <input id="category-name" name="name" required placeholder="Custom category" />
          </div>
          <div class="inline-field">
            <label for="category-type">Type</label>
            <select id="category-type" name="type">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div class="button-row">
            <button class="button" type="submit">Create category</button>
          </div>
        </form>
      </section>
    `;
  },
  budgeting(state) {
    const planned = state.plannedExpenses;
    const categories = state.categories;

    const plannedTotal = sum(planned.filter((item) => item.status !== 'reconciled').map((item) => item.amount));
    const reconciledTotal = sum(planned.filter((item) => item.status === 'reconciled').map((item) => item.amount));

    return `
      <section class="panel">
        <div class="panel-header">
          <h2>Planned Variable Expenses</h2>
          <p>Organise shopping-style lists and reconcile against transactions.</p>
        </div>
        <div class="chip-list">
          <span class="chip">Open planned spend: ${formatCurrency(plannedTotal)}</span>
          <span class="chip">Reconciled this month: ${formatCurrency(reconciledTotal)}</span>
        </div>
        <div class="card-list">
          ${
            planned.length
              ? planned
                  .map((item) => {
                    const category = categories.find((cat) => cat.id === item.categoryId);
                    const badgeClass =
                      item.status === 'reconciled' ? 'positive' : item.status === 'in-progress' ? '' : 'warning';
                    return `
                      <div class="panel">
                        <div class="panel-header">
                          <h2>${item.name}</h2>
                          <p>${category ? category.name : 'Uncategorised'} • ${formatMonth(item.plannedFor)}</p>
                        </div>
                        <div class="chip-list">
                          <span class="badge ${badgeClass}">${item.status.toUpperCase()}</span>
                          <span class="chip">${formatCurrency(item.amount)}</span>
                        </div>
                        ${
                          item.notes
                            ? `<p class="subtle">${item.notes}</p>`
                            : ''
                        }
                        <div class="button-row">
                          <button class="button secondary" data-action="mark-planned" data-id="${item.id}">
                            Mark reconciled
                          </button>
                          <button class="button danger" data-action="delete-planned" data-id="${item.id}">Delete</button>
                        </div>
                      </div>
                    `;
                  })
                  .join('')
              : '<p class="empty-state">No planned expenses — add your variable spending roadmap.</p>'
          }
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Add Planned Expense</h2>
          <p>Budget a purchase, travel plan, or upcoming celebration.</p>
        </div>
        <form data-action="add-planned">
          <div class="inline-field">
            <label for="planned-name">Name <span class="required">*</span></label>
            <input id="planned-name" name="name" required />
          </div>
          <div class="inline-field">
            <label for="planned-amount">Amount</label>
            <input id="planned-amount" name="amount" type="number" step="0.01" required />
          </div>
          <div class="inline-field">
            <label for="planned-category">Category</label>
            <select id="planned-category" name="categoryId">
              ${categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join('')}
            </select>
          </div>
          <div class="inline-field">
            <label for="planned-month">Planned month</label>
            <input id="planned-month" name="plannedFor" type="month" value="${new Date().toISOString().slice(0, 7)}" />
          </div>
          <div class="inline-field">
            <label for="planned-notes">Notes</label>
            <textarea id="planned-notes" name="notes" placeholder="Add details or justification"></textarea>
          </div>
          <div class="button-row">
            <button class="button" type="submit">Add planned expense</button>
          </div>
        </form>
      </section>
    `;
  },
  recurring(state) {
    const items = state.recurringExpenses;
    const categories = state.categories;

    return `
      <section class="panel">
        <div class="panel-header">
          <h2>Recurring Expenses & Subscriptions</h2>
          <p>Automate commitments and align them with budgets.</p>
        </div>
        <div class="card-list">
          ${
            items.length
              ? items
                  .map((item) => {
                    const category = categories.find((cat) => cat.id === item.categoryId);
                    return `
                      <div class="panel">
                        <div class="panel-header">
                          <h2>${item.name}</h2>
                          <p>${category ? category.name : 'Uncategorised'} • Next due ${formatDate(item.nextDueDate)}</p>
                        </div>
                        <div class="chip-list">
                          <span class="chip">${formatCurrency(item.amount)} / ${item.frequency}</span>
                          <span class="chip">Forecasted in budgets</span>
                        </div>
                        ${item.notes ? `<p class="subtle">${item.notes}</p>` : ''}
                        <div class="button-row">
                          <button class="button secondary" data-action="bump-recurring" data-id="${item.id}">Snooze 1 month</button>
                          <button class="button danger" data-action="delete-recurring" data-id="${item.id}">Remove</button>
                        </div>
                      </div>
                    `;
                  })
                  .join('')
              : '<p class="empty-state">No recurring expenses captured yet.</p>'
          }
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Add Recurring Expense</h2>
          <p>Track EMIs, SIPs, insurance premiums, or digital subscriptions.</p>
        </div>
        <form data-action="add-recurring">
          <div class="inline-field">
            <label>Name <span class="required">*</span></label>
            <input name="name" required />
          </div>
          <div class="inline-field">
            <label>Amount</label>
            <input name="amount" type="number" step="0.01" required />
          </div>
          <div class="inline-field">
            <label>Category</label>
            <select name="categoryId">
              ${categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join('')}
            </select>
          </div>
          <div class="inline-field">
            <label>Frequency</label>
            <select name="frequency">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
          <div class="inline-field">
            <label>Next due</label>
            <input name="nextDueDate" type="date" value="${new Date().toISOString().slice(0, 10)}" />
          </div>
          <div class="inline-field">
            <label>Notes</label>
            <textarea name="notes" placeholder="Reminder or payment details"></textarea>
          </div>
          <div class="button-row">
            <button class="button" type="submit">Add recurring expense</button>
          </div>
        </form>
      </section>
    `;
  },
  goals(state) {
    const projections = state.goalProjections ?? [];
    const categories = state.categories;

    return `
      <section class="panel">
        <div class="panel-header">
          <h2>Goal Setting & Simulations</h2>
          <p>Track progress and run what-if projections powered by our accelerator engine.</p>
        </div>
        <div class="card-list">
          ${
            projections.length
              ? projections
                  .map((goal) => {
                    const category = categories.find((cat) => cat.id === goal.categoryId);
                    return `
                      <div class="panel">
                        <div class="panel-header">
                          <h2>${goal.name}</h2>
                          <p>${category ? category.name : 'Uncategorised'} • ${goal.timeframeMonths} months</p>
                        </div>
                        <div class="chip-list">
                          <span class="chip">Target: ${formatCurrency(goal.targetAmount)}</span>
                          <span class="chip">Projected: ${formatCurrency(goal.projectedValue)}</span>
                          <span class="chip">Probability: ${(goal.probability * 100).toFixed(0)}%</span>
                        </div>
                        <div class="progress">
                          <span style="width:${clamp((goal.currentSavings / goal.targetAmount) * 100, 5, 100)}%"></span>
                        </div>
                        <div class="button-row">
                          <button class="button secondary" data-action="goal-up" data-id="${goal.id}">Increase monthly contribution</button>
                          <button class="button danger" data-action="delete-goal" data-id="${goal.id}">Delete</button>
                        </div>
                      </div>
                    `;
                  })
                  .join('')
              : '<p class="empty-state">Add your first wealth goal to simulate outcomes.</p>'
          }
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Create Goal</h2>
          <p>Link goals to categories and simulate what-if scenarios.</p>
        </div>
        <form data-action="add-goal">
          <div class="inline-field">
            <label>Name <span class="required">*</span></label>
            <input name="name" required />
          </div>
          <div class="inline-field">
            <label>Category</label>
            <select name="categoryId">
              ${categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join('')}
            </select>
          </div>
          <div class="inline-field">
            <label>Target amount</label>
            <input name="targetAmount" type="number" step="0.01" required />
          </div>
          <div class="inline-field">
            <label>Current savings</label>
            <input name="currentSavings" type="number" step="0.01" value="0" />
          </div>
          <div class="inline-field">
            <label>Timeframe (months)</label>
            <input name="timeframeMonths" type="number" min="1" value="12" />
          </div>
          <div class="inline-field">
            <label>Risk profile</label>
            <select name="riskProfile">
              <option value="conservative">Conservative</option>
              <option value="balanced" selected>Balanced</option>
              <option value="growth">Growth</option>
            </select>
          </div>
          <div class="button-row">
            <button class="button" type="submit">Add goal</button>
          </div>
        </form>
      </section>
    `;
  },
  insights(state) {
    const items = state.insights;
    return `
      <section class="panel">
        <div class="panel-header">
          <h2>Actionable Insights</h2>
          <p>Proactive nudges generated by rules-based analytics.</p>
        </div>
        <div class="card-list">
          ${
            items.length
              ? items
                  .map(
                    (item) => `
                      <div class="panel">
                        <div class="panel-header">
                          <h2>${item.title}</h2>
                          <p>${new Date().toLocaleDateString('en-IN')}</p>
                        </div>
                        <p>${item.body}</p>
                        <div class="chip-list">
                          <span class="badge ${item.severity === 'warning' ? 'warning' : ''}">${item.severity.toUpperCase()}</span>
                        </div>
                      </div>
                    `
                  )
                  .join('')
              : '<p class="empty-state">Insights will appear after analysing your data.</p>'
          }
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Create Custom Insight</h2>
          <p>Document manual recommendations to share with your CFO or advisor.</p>
        </div>
        <form data-action="add-insight">
          <div class="inline-field">
            <label>Title <span class="required">*</span></label>
            <input name="title" required />
          </div>
          <div class="inline-field">
            <label>Detail</label>
            <textarea name="body" placeholder="Recommendation or observation"></textarea>
          </div>
          <div class="inline-field">
            <label>Severity</label>
            <select name="severity">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
            </select>
          </div>
          <div class="button-row">
            <button class="button" type="submit">Add insight</button>
          </div>
        </form>
      </section>
    `;
  },
  accelerator(state) {
    const metrics = state.wealthAccelerator;
    const monthlySavings = state.metrics.income - state.metrics.expenses;
    const reinvestSuggestion = monthlySavings > 0
      ? `Redirect ₹${formatNumber(monthlySavings * 0.6)} into growth assets to unlock accelerated compounding.`
      : 'Focus on trimming expenses to unlock investable surplus.';

    return `
      <section class="panel">
        <div class="panel-header">
          <h2>Wealth Accelerator Engine</h2>
          <p>Premium intelligence to unlock compounding and protect capital.</p>
        </div>
        <div class="grid-metrics">
          ${metricCard('Capital Efficiency Score', metrics.capitalEfficiencyScore, 'Balance sheet strength vs. burn')}
          ${metricCard('Protection Gap', formatCurrency(metrics.protectionGap), 'Insurance & liquidity coverage delta')}
          ${metricCard('Opportunity Alerts', metrics.opportunityCostAlerts.length, 'Recommended optimisation levers')}
        </div>
        <div class="panel">
          <div class="panel-header">
            <h2>Recommendations</h2>
            <p>Action these steps to fast-track wealth outcomes.</p>
          </div>
          <ul>
            ${metrics.opportunityCostAlerts.map((item) => `<li>${item}</li>`).join('')}
            <li>${reinvestSuggestion}</li>
          </ul>
        </div>
      </section>
    `;
  }
};

function metricCard(title, value, subtitle) {
  return `
    <div class="metric-card">
      <span class="label">${title}</span>
      <span class="value">${value}</span>
      <span class="subtle">${subtitle}</span>
    </div>
  `;
}

function radialGauge(savingsRate) {
  const normalised = clamp(savingsRate, -1, 1);
  const degrees = ((normalised + 1) / 2) * 180;
  const label = formatPercent(savingsRate);
  return `
    <div style="position:relative; display:grid; place-items:center; padding:2rem 0;">
      <svg width="220" height="120">
        <path d="M20 100 A90 90 0 0 1 200 100" stroke="rgba(148,163,184,0.35)" stroke-width="18" fill="none" stroke-linecap="round"></path>
        <path d="M20 100 A90 90 0 0 1 200 100" stroke="#38bdf8" stroke-width="18" fill="none" stroke-linecap="round"
          stroke-dasharray="${degrees}, 360"></path>
        <text x="110" y="90" fill="#e2e8f0" font-size="24" text-anchor="middle">${label}</text>
      </svg>
      <small class="muted">Aim for ≥40% to unlock accelerated compounding</small>
    </div>
  `;
}

function lineChart(series) {
  if (!series.length) {
    return '<p class="empty-state">No data available yet.</p>';
  }
  const maxValue = Math.max(...series.map((row) => Math.max(row.income, row.expense, Math.abs(row.net))), 1);
  const pointsIncome = series
    .map((row, index) => {
      const x = (index / Math.max(1, series.length - 1)) * 560 + 20;
      const y = 220 - (row.income / maxValue) * 180;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
  const pointsExpense = series
    .map((row, index) => {
      const x = (index / Math.max(1, series.length - 1)) * 560 + 20;
      const y = 220 - (row.expense / maxValue) * 180;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
  const labels = series.map((row) => row.month);
  return `
    <div class="chart-area">
      <svg viewBox="0 0 600 240">
        <g>
          ${Array.from({ length: 5 })
            .map((_, idx) => `<line x1="20" x2="580" y1="${40 * idx + 20}" y2="${40 * idx + 20}" stroke="rgba(148,163,184,0.12)"></line>`)
            .join('')}
        </g>
        <path d="${pointsIncome}" stroke="#38bdf8" stroke-width="3" fill="none" stroke-linecap="round"></path>
        <path d="${pointsExpense}" stroke="#f97316" stroke-width="3" fill="none" stroke-linecap="round"></path>
        ${labels
          .map((label, index) => {
            const x = (index / Math.max(1, series.length - 1)) * 560 + 20;
            return `<text x="${x}" y="230" text-anchor="middle">${label}</text>`;
          })
          .join('')}
      </svg>
    </div>
  `;
}

export function renderView(view, state) {
  const renderer = viewDefinitions[view];
  if (!renderer) {
    return `<p class="empty-state">Unknown view: ${view}</p>`;
  }
  return renderer(state);
}

export const viewList = [
  { id: 'dashboard', label: 'CEO Dashboard' },
  { id: 'balanceSheet', label: 'Unified Balance Sheet' },
  { id: 'trend', label: 'Trend Analysis' },
  { id: 'budgeting', label: 'Smart Budgeting' },
  { id: 'recurring', label: 'Recurring Expenses Hub' },
  { id: 'goals', label: 'Goal Simulator' },
  { id: 'insights', label: 'Actionable Insights' },
  { id: 'accelerator', label: 'Wealth Accelerator' }
];
