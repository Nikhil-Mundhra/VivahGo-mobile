export const DEFAULT_EVENTS = [
  { id:1, name:"Haldi", emoji:"🌿", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:0 },
  { id:2, name:"Mehndi", emoji:"🌸", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:1 },
  { id:3, name:"Sangeet", emoji:"🎶", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:2 },
  { id:4, name:"Baraat", emoji:"🐴", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:3 },
  { id:5, name:"Pheras", emoji:"🔥", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:4 },
  { id:6, name:"Reception", emoji:"👑", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:5 },
];

export const BUDGET_CATEGORIES = [
  { id:"venue", label:"Venue", emoji:"🏛️", color:"#E53935" },
  { id:"catering", label:"Catering", emoji:"🍽️", color:"#F57C00" },
  { id:"decor", label:"Decoration", emoji:"🌺", color:"#7B1FA2" },
  { id:"photography", label:"Photography", emoji:"📸", color:"#1565C0" },
  { id:"attire", label:"Attire & Jewelry", emoji:"💍", color:"#C62828" },
  { id:"music", label:"Music & DJ", emoji:"🎵", color:"#00796B" },
  { id:"invites", label:"Invitations", emoji:"💌", color:"#AD1457" },
  { id:"transport", label:"Transport", emoji:"🚌", color:"#4527A0" },
  { id:"pandit", label:"Pandit & Rituals", emoji:"🪔", color:"#E65100" },
  { id:"misc", label:"Miscellaneous", emoji:"✨", color:"#37474F" },
];

export const DEFAULT_VENDORS = [
  { id:1, name:"Regal Frames Studio", type:"Photography", emoji:"📸", rating:5, price:"₹1,20,000", city:"Delhi", booked:false },
  { id:2, name:"Spice Garden Caterers", type:"Catering", emoji:"🍽️", rating:4, price:"₹800/plate", city:"Gurgaon", booked:false },
  { id:3, name:"Petal & Gold Decor", type:"Decoration", emoji:"🌺", rating:5, price:"₹2,50,000", city:"Delhi", booked:false },
  { id:4, name:"DJ Rhythm Beats", type:"Music", emoji:"🎵", rating:4, price:"₹45,000", city:"Noida", booked:false },
  { id:5, name:"Pandit Sharma Ji", type:"Pandit", emoji:"🪔", rating:5, price:"₹21,000", city:"Delhi", booked:true },
  { id:6, name:"Grand Mahal Venue", type:"Venue", emoji:"🏛️", rating:5, price:"₹8,00,000", city:"Faridabad", booked:true },
];

export const DEFAULT_TASKS = [
  { id:1, name:"Book wedding venue", done:true, due:"6 months before", priority:"high", group:"6 months" },
  { id:2, name:"Finalise guest list", done:true, due:"5 months before", priority:"high", group:"6 months" },
  { id:3, name:"Book photographer", done:false, due:"5 months before", priority:"high", group:"5 months" },
  { id:4, name:"Send save-the-dates", done:false, due:"4 months before", priority:"medium", group:"5 months" },
  { id:5, name:"Book caterer & menu tasting", done:false, due:"4 months before", priority:"high", group:"4 months" },
  { id:6, name:"Order bridal outfit", done:false, due:"3 months before", priority:"high", group:"4 months" },
  { id:7, name:"Book makeup artist", done:false, due:"3 months before", priority:"medium", group:"3 months" },
  { id:8, name:"Send wedding invitations", done:false, due:"2 months before", priority:"high", group:"3 months" },
  { id:9, name:"Finalise mehndi design", done:false, due:"1 month before", priority:"medium", group:"1 month" },
  { id:10, name:"Confirm all vendors", done:false, due:"2 weeks before", priority:"high", group:"Final" },
  { id:11, name:"Prepare wedding day timeline", done:false, due:"1 week before", priority:"high", group:"Final" },
];

export const QUESTIONS = [
  { key:"bride", q:"What is the bride's name? 🌸", placeholder:"Enter bride's name...", type:"text" },
  { key:"groom", q:"And the groom's name? 🤵", placeholder:"Enter groom's name...", type:"text" },
  { key:"date", q:"What's your dream wedding date? 📅", placeholder:"e.g. 25 November 2025", type:"text" },
  { key:"venue", q:"Which city or venue are you considering? 🏛️", placeholder:"e.g. Delhi, Jaipur, Udaipur...", type:"text" },
  { key:"guests", q:"How many guests are you expecting? 👨‍👩‍👧‍👦", placeholder:"e.g. 300", type:"text" },
  { key:"budget", q:"What's your total wedding budget (₹)? 💰", placeholder:"e.g. 50,00,000", type:"text" },
];

export const AI_RESPONSES = [
  "Wonderful! ",
  "Lovely name! ",
  "Exciting! ",
  "Great choice! ",
  "Perfect! ",
  "Excellent! ",
];