import { useState } from "react";
import { useSwipeDown } from "../../../shared/hooks/useSwipeDown.js";
import { useBackButtonClose } from "../../../shared/hooks/useBackButtonClose.js";

function createTaskForm() {
  return {name:"",due:"",group:"Final",priority:"medium",eventId:""};
}

function TasksScreen({ tasks, setTasks, events, planId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(createTaskForm());
  const taskSwipe = useSwipeDown(() => setShowAdd(false));

  const groups = [...new Set(tasks.map(t=>t.group))];
  const done = tasks.filter(t=>t.done).length;
  const pct = tasks.length ? Math.round(done/tasks.length*100) : 0;

  function getTaskEvent(task) {
    return events.find(event => String(event.id) === String(task.eventId));
  }

  function toggle(id) { setTasks(ts=>ts.map(t=>t.id===id?{...t,done:!t.done}:t)); }

  function add() {
    if(!form.name) return;
    const linkedEvent = events.find(event => String(event.id) === String(form.eventId));
    setTasks(ts=>[...ts,{...form,id:Date.now(),done:false,planId,ceremony:linkedEvent?.name || "General"}]);
    setForm(createTaskForm());
    setShowAdd(false);
  }

  function cancelAdd() {
    setForm(createTaskForm());
    setShowAdd(false);
  }

  useBackButtonClose(showAdd, cancelAdd);

  const PRIORITY_COLORS = {high:"#EF5350",medium:"#FFA726",low:"#66BB6A"};

  return (
    <div>
      {/* Progress */}
      <div style={{padding:"0 16px"}}>
        <div style={{background:"var(--color-white)",borderRadius:20,padding:"18px 20px",border:"1px solid rgba(212,175,55,0.15)",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{fontSize:12,color:"var(--color-light-text)",textTransform:"uppercase",letterSpacing:1}}>Wedding Checklist</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:700,color:"var(--color-crimson)"}}>{done}/{tasks.length} tasks done</div>
            </div>
            <div style={{width:54,height:54,borderRadius:"50%",background:`conic-gradient(var(--color-gold) ${pct*3.6}deg, rgba(212,175,55,0.1) 0)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:42,height:42,borderRadius:"50%",background:"var(--color-white)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"var(--color-gold)"}}>{pct}%</div>
            </div>
          </div>
          <div className="progress-bar" style={{height:6}}>
            <div className="progress-fill" style={{width:`${pct}%`}}/>
          </div>
        </div>
      </div>

      <div className="section-head" style={{marginTop:20}}>
        <div className="section-title">Checklist</div>
        <button className="section-action guest-section-add" onClick={()=>setShowAdd(true)}>+ Add</button>
      </div>

      {groups.map(group=>(
        <div key={group}>
          <div className="timeline-label">{group}</div>
          <div style={{background:"var(--color-white)",borderRadius:16,margin:"0 16px 12px",border:"1px solid rgba(212,175,55,0.15)"}}>
            {tasks.filter(t=>t.group===group).map(t=>(
              <div className="task-item" key={t.id} onClick={()=>toggle(t.id)}>
                <div className={`task-check${t.done?" done":""}`}>
                  {t.done && <span style={{color:"var(--color-deep-red)",fontSize:12,fontWeight:700}}>✓</span>}
                </div>
                <div className="task-info">
                  <div className={`task-name${t.done?" done":""}`}>{t.name}</div>
                  <div className="task-due">📅 {t.due}</div>
                  <div className="task-due" style={{marginTop:2}}>
                    {getTaskEvent(t) ? `${getTaskEvent(t).emoji} ${getTaskEvent(t).name}` : `✨ ${t.ceremony || "General"}`}
                  </div>
                </div>
                <div className="task-priority" style={{background:PRIORITY_COLORS[t.priority]||"#9E9E9E"}}/>
              </div>
            ))}
          </div>
        </div>
      ))}
      {showAdd && (
        <div className="modal-overlay" onClick={cancelAdd}>
          <div className="modal" {...taskSwipe.modalProps} onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Add Task ✅</div>
            <div className="input-group">
              <div className="input-label">Task</div>
              <input className="input-field" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="What needs to be done?"/>
            </div>
            <div className="input-group">
              <div className="input-label">Due / Timeline</div>
              <input className="input-field" value={form.due} onChange={e=>setForm({...form,due:e.target.value})} placeholder="e.g. 3 months before"/>
            </div>
            <div className="input-group">
              <div className="input-label">Group</div>
              <select className="select-field" value={form.group} onChange={e=>setForm({...form,group:e.target.value})}>
                {["6 months","5 months","4 months","3 months","2 months","1 month","Final","Post Wedding"].map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="input-group">
              <div className="input-label">Linked Ceremony/Event</div>
              <select className="select-field" value={form.eventId} onChange={e=>setForm({...form,eventId:e.target.value})}>
                <option value="">✨ General</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.emoji} {event.name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <div className="input-label">Priority</div>
              <select className="select-field" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <button className="btn-secondary" onClick={cancelAdd}>Cancel</button>
            <button className="btn-primary" onClick={add}>Add Task</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TasksScreen;
