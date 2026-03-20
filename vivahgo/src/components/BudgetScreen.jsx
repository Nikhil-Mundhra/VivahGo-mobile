import { useState } from "react";
import { BUDGET_CATEGORIES } from "../data";
import { fmt } from "../utils";

function BudgetScreen({ expenses, setExpenses, wedding }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({name:"",amount:"",category:"venue",note:""});
  const totalBudget = Number((wedding.budget||"0").replace(/[^0-9]/g,""));
  const totalSpent = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const remaining = totalBudget - totalSpent;
  const pct = totalBudget ? Math.min(100, Math.round(totalSpent/totalBudget*100)) : 0;

  function addExpense() {
    if(!form.name||!form.amount) return;
    setExpenses(ex=>[...ex,{...form,id:Date.now(),amount:Number(form.amount)}]);
    setForm({name:"",amount:"",category:"venue",note:""});
    setShowAdd(false);
  }
  function deleteExp(id) { setExpenses(ex=>ex.filter(e=>e.id!==id)); }

  const byCategory = BUDGET_CATEGORIES.map(cat=>({
    ...cat,
    spent: expenses.filter(e=>e.category===cat.id).reduce((s,e)=>s+Number(e.amount),0)
  })).filter(c=>c.spent>0).sort((a,b)=>b.spent-a.spent);

  return (
    <div>
      {/* Summary */}
      <div style={{padding:"16px 16px 0"}}>
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
      {byCategory.length > 0 && (
        <>
          <div className="section-head">
            <div className="section-title">By Category</div>
          </div>
          <div className="card">
            {byCategory.map(cat=>(
              <div className="cat-bar-row" key={cat.id}>
                <div className="cat-bar-top">
                  <div className="cat-bar-name"><span>{cat.emoji}</span> {cat.label}</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:13,color:"var(--color-dark-text)",fontWeight:500}}>{fmt(cat.spent)}</span>
                    <span className="cat-bar-pct">{totalSpent?Math.round(cat.spent/totalSpent*100):0}%</span>
                  </div>
                </div>
                <div className="cat-bar-track">
                  <div className="cat-bar-fill" style={{width:`${totalSpent?Math.round(cat.spent/totalSpent*100):0}%`,background:cat.color}}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Expenses List */}
      <div className="section-head">
        <div className="section-title">All Expenses</div>
        <button className="section-action" onClick={()=>setShowAdd(true)}>+ Add</button>
      </div>
      {expenses.length === 0 ? (
        <div style={{textAlign:"center",padding:"30px 20px"}}>
          <div style={{fontSize:40,marginBottom:8}}>💰</div>
          <div style={{fontSize:14,color:"var(--color-light-text)"}}>No expenses yet. Add your first one!</div>
          <button className="btn-primary" style={{width:"auto",padding:"10px 24px",marginTop:16}} onClick={()=>setShowAdd(true)}>Add Expense</button>
        </div>
      ) : (
        <div className="card">
          {expenses.map(e=>{
            const cat = BUDGET_CATEGORIES.find(c=>c.id===e.category)||BUDGET_CATEGORIES[9];
            return (
              <div className="expense-item" key={e.id} style={{cursor:"pointer"}} onClick={()=>deleteExp(e.id)}>
                <div className="expense-cat-dot" style={{background:cat.color+"22"}}>{cat.emoji}</div>
                <div className="expense-info">
                  <div className="expense-name">{e.name}</div>
                  <div className="expense-cat">{cat.label}{e.note?` · ${e.note}`:""}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                  <div className="expense-amount">{fmt(e.amount)}</div>
                  <div style={{fontSize:10,color:"#EF5350"}}>tap to delete</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button className="fab" onClick={()=>setShowAdd(true)}>+</button>

      {showAdd && (
        <div className="modal-overlay" onClick={()=>setShowAdd(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Add Expense 💰</div>
            <div className="input-group">
              <div className="input-label">Expense Name</div>
              <input className="input-field" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Venue advance payment"/>
            </div>
            <div className="input-group">
              <div className="input-label">Amount (₹)</div>
              <input className="input-field" type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0"/>
            </div>
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
            <button className="btn-primary" onClick={addExpense}>Add Expense</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetScreen;