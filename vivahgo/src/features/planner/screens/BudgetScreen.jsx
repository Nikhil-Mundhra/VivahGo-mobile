import { useState } from "react";
import { BUDGET_CATEGORIES, EXPENSE_AREAS } from "../../../data";
import { fmt } from "../../../shared/lib/core.js";
import { useSwipeDown } from "../../../shared/hooks/useSwipeDown.js";
import { useBackButtonClose } from "../../../shared/hooks/useBackButtonClose.js";

function createExpenseForm(events) {
  return {
    name: "",
    amount: "",
    expenseDate: "",
    category: "venue",
    area: events.length ? "ceremony" : "general",
    eventId: events[0]?.id ?? "",
    note: "",
  };
}

function createExpenseFormFromExpense(expense, events) {
  return {
    ...createExpenseForm(events),
    ...expense,
    amount: expense?.amount ? String(expense.amount) : "",
  };
}

function BudgetScreen({ expenses, setExpenses, wedding, events, planId }) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [expandedCeremonyId, setExpandedCeremonyId] = useState(null);
  const [form, setForm] = useState(() => createExpenseForm(events));
  const totalBudget = Number((wedding.budget||"0").replace(/[^0-9]/g,""));
  const totalSpent = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const remaining = totalBudget - totalSpent;
  const pct = totalBudget ? Math.min(100, Math.round(totalSpent/totalBudget*100)) : 0;
  const canSaveExpense = Boolean(form.name && form.amount && (form.area !== "ceremony" || form.eventId));

  function updateArea(area) {
    setForm(current => ({
      ...current,
      area,
      eventId: area === "ceremony" ? (current.eventId || events[0]?.id || "") : "",
    }));
  }

  function openAddExpense() {
    setEditingExpenseId(null);
    setForm(createExpenseForm(events));
    setShowEditor(true);
  }

  function openEditExpense(expense) {
    setEditingExpenseId(expense.id);
    setForm(createExpenseFormFromExpense(expense, events));
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingExpenseId(null);
    setForm(createExpenseForm(events));
  }

  useBackButtonClose(showEditor, closeEditor);

  const budgetSwipe = useSwipeDown(() => closeEditor(), 110);

  function saveExpense() {
    if (!canSaveExpense) return;
    if (editingExpenseId !== null) {
      setExpenses(existing => existing.map(expense => (
        expense.id === editingExpenseId
          ? { ...expense, ...form, id: editingExpenseId, amount: Number(form.amount), planId }
          : expense
      )));
    } else {
      setExpenses(existing => [...existing, { ...form, id: Date.now(), amount: Number(form.amount), planId }]);
    }
    closeEditor();
  }
  function deleteExp(id) { setExpenses(ex=>ex.filter(e=>e.id!==id)); }

  const byArea = EXPENSE_AREAS.map(area => ({
    ...area,
    spent: expenses.filter(expense => expense.area === area.id).reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
  })).filter(area => area.spent > 0).sort((a, b) => b.spent - a.spent);

  const byEvent = events.map(event => ({
    ...event,
    spent: expenses
      .filter(expense => expense.area === "ceremony" && String(expense.eventId) === String(event.id))
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
  })).filter(event => event.spent > 0).sort((a, b) => b.spent - a.spent);

  const byCategory = BUDGET_CATEGORIES.map(cat=>({
    ...cat,
    spent: expenses.filter(e=>e.category===cat.id).reduce((s,e)=>s+Number(e.amount),0)
  })).filter(c=>c.spent>0).sort((a,b)=>b.spent-a.spent);

  function getCeremonyExpenseItems(eventId) {
    return expenses
      .filter(expense => expense.area === "ceremony" && String(expense.eventId) === String(eventId))
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  }

  function getCategoryExpenseItems(categoryId) {
    return expenses
      .filter(expense => expense.category === categoryId)
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  }

  function renderExpenseBreakdownRow(expense) {
    const area = EXPENSE_AREAS.find(item => item.id === expense.area) || EXPENSE_AREAS[EXPENSE_AREAS.length - 1];
    const event = events.find(item => String(item.id) === String(expense.eventId));

    return (
      <button key={expense.id} type="button" className="budget-breakdown-item" onClick={() => openEditExpense(expense)}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
          <div style={{fontSize:12.5,color:"var(--color-dark-text)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{expense.name}</div>
          <div style={{fontSize:13,color:"var(--color-crimson)",fontWeight:600,whiteSpace:"nowrap"}}>{fmt(expense.amount)}</div>
        </div>
        <div className="expense-cat" style={{marginTop:2}}>
          {expense.expenseDate || "Date not set"} · {area.emoji} {area.label}{event ? ` · ${event.name}` : ""}{expense.note ? ` · ${expense.note}` : ""}
        </div>
      </button>
    );
  }

  return (
    <div>
      {/* Summary */}
      <div style={{padding:"0 16px"}}>
        <div className="budget-summary">
          <div className="budget-total-label">Total Budget</div>
          <div className="budget-total-amount">{fmt(totalBudget)}</div>
          <div className="budget-row">
            <div className="budget-mini">
              <div className="budget-mini-label">Spent</div>
              <div className="budget-mini-val spent">{fmt(totalSpent)}</div>
            </div>
            <div className="budget-mini">
              <div className="budget-mini-label">Remaining</div>
              <div className="budget-mini-val remaining">{fmt(remaining)}</div>
            </div>
            <div className="budget-mini">
              <div className="budget-mini-label">Used</div>
              <div className="budget-mini-val">{pct}%</div>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{width:`${pct}%`}}/>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {byArea.length > 0 && (
        <>
          <div className="section-head" style={{marginTop:20}}>
            <div className="section-title">By Planning Area</div>
          </div>
          <div className="card">
            {byArea.map(area => (
              <div className="cat-bar-row" key={area.id}>
                <div className="cat-bar-top">
                  <div className="cat-bar-name"><span>{area.emoji}</span> {area.label}</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:13,color:"var(--color-dark-text)",fontWeight:500}}>{fmt(area.spent)}</span>
                    <span className="cat-bar-pct">{totalSpent?Math.round(area.spent/totalSpent*100):0}%</span>
                  </div>
                </div>
                <div className="cat-bar-track">
                  <div className="cat-bar-fill" style={{width:`${totalSpent?Math.round(area.spent/totalSpent*100):0}%`}}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {byEvent.length > 0 && (
        <>
          <div className="section-head" style={{marginTop:20}}>
            <div className="section-title">By Ceremony</div>
          </div>
          <div className="card">
            {byEvent.map(event => {
              const isExpanded = expandedCeremonyId === event.id;
              const ceremonyItems = getCeremonyExpenseItems(event.id);

              return (
              <div className="cat-bar-row" key={event.id}>
                <button type="button" className="cat-bar-top cat-breakdown-toggle" onClick={() => setExpandedCeremonyId(current => current === event.id ? null : event.id)}>
                  <div className="cat-bar-name"><span>{event.emoji}</span> {event.name}</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:13,color:"var(--color-dark-text)",fontWeight:500}}>{fmt(event.spent)}</span>
                    <span className="cat-bar-pct">{totalSpent?Math.round(event.spent/totalSpent*100):0}%</span>
                    <span className="cat-bar-pct" style={{minWidth:14,textAlign:"right"}}>{isExpanded ? "−" : "+"}</span>
                  </div>
                </button>
                <div className="expense-cat">{event.date || "Date TBD"}{event.venue ? ` · ${event.venue}` : ""}</div>
                <div className="cat-bar-track" style={{marginTop:6}}>
                  <div className="cat-bar-fill" style={{width:`${totalSpent?Math.round(event.spent/totalSpent*100):0}%`}}/>
                </div>
                {isExpanded && (
                  <div className="budget-breakdown-list">
                    {ceremonyItems.map(renderExpenseBreakdownRow)}
                  </div>
                )}
              </div>
            );})}
          </div>
        </>
      )}

      {byCategory.length > 0 && (
        <>
          <div className="section-head" style={{marginTop:20}}>
            <div className="section-title">By Category</div>
          </div>
          <div className="card">
            {byCategory.map(cat=>{
              const isExpanded = expandedCategoryId === cat.id;
              const categoryItems = getCategoryExpenseItems(cat.id);

              return (
              <div className="cat-bar-row" key={cat.id}>
                <button type="button" className="cat-bar-top cat-breakdown-toggle" onClick={() => setExpandedCategoryId(current => current === cat.id ? null : cat.id)}>
                  <div className="cat-bar-name"><span>{cat.emoji}</span> {cat.label}</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:13,color:"var(--color-dark-text)",fontWeight:500}}>{fmt(cat.spent)}</span>
                    <span className="cat-bar-pct">{totalSpent?Math.round(cat.spent/totalSpent*100):0}%</span>
                    <span className="cat-bar-pct" style={{minWidth:14,textAlign:"right"}}>{isExpanded ? "−" : "+"}</span>
                  </div>
                </button>
                <div className="cat-bar-track">
                  <div className="cat-bar-fill" style={{width:`${totalSpent?Math.round(cat.spent/totalSpent*100):0}%`,background:cat.color}}/>
                </div>
                {isExpanded && (
                  <div className="budget-breakdown-list">
                    {categoryItems.map(renderExpenseBreakdownRow)}
                  </div>
                )}
              </div>
            );})}
          </div>
        </>
      )}

      {/* Expenses List */}
      <div className="section-head" style={{marginTop:20}}>
        <div className="section-title">All Expenses</div>
        <button className="section-action guest-section-add" onClick={openAddExpense}>+ Add</button>
      </div>
      {expenses.length === 0 ? (
        <div style={{textAlign:"center",padding:"30px 20px"}}>
          <div style={{fontSize:40,marginBottom:8}}>💰</div>
          <div style={{fontSize:14,color:"var(--color-light-text)"}}>No expenses yet. Add your first one!</div>
          <button className="btn-primary" style={{width:"auto",padding:"10px 24px",marginTop:16}} onClick={openAddExpense}>Add Expense</button>
        </div>
      ) : (
        <div className="card">
          {expenses.map(e=>{
            const cat = BUDGET_CATEGORIES.find(c=>c.id===e.category)||BUDGET_CATEGORIES[9];
            const area = EXPENSE_AREAS.find(item => item.id === e.area) || EXPENSE_AREAS[EXPENSE_AREAS.length - 1];
            const event = events.find(item => String(item.id) === String(e.eventId));
            return (
              <div className="expense-item expense-item-editable" key={e.id} onClick={() => openEditExpense(e)}>
                <div className="expense-cat-dot" style={{background:cat.color+"22"}}>{cat.emoji}</div>
                <div className="expense-info">
                  <div className="expense-name">{e.name}</div>
                  <div className="expense-cat">{e.expenseDate || "Date not set"} · {area.emoji} {area.label} · {cat.label}{event ? ` · ${event.name}` : ""}{e.note?` · ${e.note}`:""}</div>
                </div>
                <div className="expense-actions">
                  <div className="expense-amount">{fmt(e.amount)}</div>
                  <button
                    type="button"
                    className="expense-delete-btn"
                    onClick={(eventObject) => {
                      eventObject.stopPropagation();
                      deleteExp(e.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showEditor && (
        <div className="modal-overlay" onClick={closeEditor}>
          <div className="modal" {...budgetSwipe.modalProps} onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{editingExpenseId !== null ? "Edit Expense 💰" : "Add Expense 💰"}</div>
            <div className="input-group">
              <div className="input-label">Expense Name</div>
              <input className="input-field" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Venue advance payment"/>
            </div>
            <div className="input-group">
              <div className="input-label">Amount (₹)</div>
              <input className="input-field" type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0"/>
            </div>
            <div className="input-group">
              <div className="input-label">Expense Date</div>
              <input className="input-field" type="date" value={form.expenseDate} onChange={e=>setForm({...form,expenseDate:e.target.value})}/>
            </div>
            <div className="input-group">
              <div className="input-label">Planning Area</div>
              <select className="select-field" value={form.area} onChange={e=>updateArea(e.target.value)}>
                {EXPENSE_AREAS.map(area=><option key={area.id} value={area.id}>{area.emoji} {area.label}</option>)}
              </select>
            </div>
            {form.area === "ceremony" && (
              <div className="input-group">
                <div className="input-label">Ceremony</div>
                <select className="select-field" value={form.eventId} onChange={e=>setForm({...form,eventId:e.target.value})}>
                  {!events.length && <option value="">Add a ceremony first</option>}
                  {events.map(event => <option key={event.id} value={event.id}>{event.emoji} {event.name}</option>)}
                </select>
              </div>
            )}
            <div className="input-group">
              <div className="input-label">Category</div>
              <select className="select-field" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
                {BUDGET_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
            <div className="input-group">
              <div className="input-label">Note (optional)</div>
              <input className="input-field" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="e.g. 50% advance"/>
            </div>
            {editingExpenseId !== null && (
              <button className="btn-secondary-danger" onClick={() => { deleteExp(editingExpenseId); closeEditor(); }}>
                Delete Expense
              </button>
            )}
            <button className="btn-secondary" onClick={closeEditor}>
              Cancel
            </button>
            <button className="btn-primary" onClick={saveExpense} style={!canSaveExpense ? {opacity:0.55} : undefined}>
              {editingExpenseId !== null ? "Save Changes" : "Add Expense"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetScreen;
