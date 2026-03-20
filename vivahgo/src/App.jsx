import { useState } from "react";
import "./styles.css";
import SplashScreen from "./components/SplashScreen";
import OnboardingScreen from "./components/OnboardingScreen";
import Dashboard from "./components/Dashboard";
import EventsScreen from "./components/EventsScreen";
import BudgetScreen from "./components/BudgetScreen";
import GuestsScreen from "./components/GuestsScreen";
import VendorsScreen from "./components/VendorsScreen";
import TasksScreen from "./components/TasksScreen";
import { DEFAULT_EVENTS, DEFAULT_VENDORS, DEFAULT_TASKS } from "./data";
import { NAV_ITEMS } from "./constants";

export default function VivahGoApp() {
  const [screen, setScreen] = useState("splash"); // splash | onboard | app
  const [tab, setTab] = useState("home");
  const [wedding, setWedding] = useState({bride:"",groom:"",date:"",venue:"",guests:"",budget:""});
  const [events, setEvents] = useState(DEFAULT_EVENTS);
  const [expenses, setExpenses] = useState([]);
  const [guests, setGuests] = useState([]);
  const [vendors, setVendors] = useState(DEFAULT_VENDORS);
  const [tasks, setTasks] = useState(DEFAULT_TASKS);

  function handleOnboardComplete(answers) {
    setWedding(answers);
    // Pre-load some sample data
    setGuests([
      {id:1,name:"Rajesh Sharma",side:"bride",phone:"+91 98765 43210",rsvp:"yes"},
      {id:2,name:"Priya Mehta",side:"bride",phone:"+91 98765 12345",rsvp:"yes"},
      {id:3,name:"Vikram Singh",side:"groom",phone:"+91 99887 56123",rsvp:"pending"},
      {id:4,name:"Sunita Verma",side:"groom",phone:"+91 91234 56789",rsvp:"no"},
      {id:5,name:"Arjun Kapoor",side:"bride",phone:"+91 87654 32109",rsvp:"pending"},
    ]);
    setExpenses([
      {id:1,name:"Venue advance",amount:200000,category:"venue",note:"50% advance"},
      {id:2,name:"Bridal lehenga",amount:150000,category:"attire",note:"Sabyasachi"},
    ]);
    setScreen("app");
  }

  return (
    <div className="app-shell">
      {screen==="splash" && <SplashScreen onStart={()=>setScreen("onboard")}/>}
      {screen==="onboard" && <OnboardingScreen onComplete={handleOnboardComplete}/>}
      {screen==="app" && (
        <div className="main-app">
          {/* Top Bar */}
          <div className="top-bar">
            <div className="top-bar-pattern">🪔</div>
            <div className="top-bar-greeting">Your Wedding</div>
            <div className="top-bar-names">
              {wedding.bride||"Bride"} & {wedding.groom||"Groom"}
            </div>
            <div className="top-bar-meta">
              {wedding.date && <div className="top-bar-chip">📅 {wedding.date}</div>}
              {wedding.venue && <div className="top-bar-chip">📍 {wedding.venue}</div>}
            </div>
          </div>

          {/* Content */}
          <div className="content-area">
            {tab==="home" && <Dashboard wedding={wedding} events={events} expenses={expenses} guests={guests} budget={wedding.budget}/>}
            {tab==="events" && <EventsScreen events={events} setEvents={setEvents}/>}
            {tab==="budget" && <BudgetScreen expenses={expenses} setExpenses={setExpenses} wedding={wedding}/>}
            {tab==="guests" && <GuestsScreen guests={guests} setGuests={setGuests}/>}
            {tab==="vendors" && <VendorsScreen vendors={vendors} setVendors={setVendors}/>}
            {tab==="tasks" && <TasksScreen tasks={tasks} setTasks={setTasks}/>}
          </div>

          {/* Bottom Nav */}
          <div className="bottom-nav">
            {NAV_ITEMS.map(n=>(
              <div key={n.id} className={`nav-item${tab===n.id?" active":""}`} onClick={()=>setTab(n.id)}>
                <div className="nav-icon">{n.icon}</div>
                <div className="nav-label">{n.label}</div>
                {tab===n.id && <div className="nav-active-dot"/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
