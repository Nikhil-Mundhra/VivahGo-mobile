export const DEFAULT_EVENTS = [
  // Pre-wedding
  { id:1,  name:"Roka",          emoji:"🪔", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:0  },
  { id:2,  name:"Sagai",         emoji:"💍", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:1  },
  { id:3,  name:"Ganesh Puja",   emoji:"🐘", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:2  },
  { id:4,  name:"Haldi",         emoji:"🌿", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:3  },
  { id:5,  name:"Mehndi",        emoji:"🌸", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:4  },
  { id:6,  name:"Sangeet",       emoji:"🎶", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:5  },
  // Wedding day
  { id:7,  name:"Baraat",        emoji:"🐴", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:6  },
  { id:8,  name:"Jaimala",       emoji:"🌹", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:7  },
  { id:9,  name:"Pheras",        emoji:"🔥", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:8  },
  { id:10, name:"Kanyadaan",     emoji:"🙏", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:9  },
  { id:11, name:"Saptapadi",     emoji:"🪷", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:10 },
  { id:12, name:"Sindoor Daan",  emoji:"❤️", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:11 },
  // Post-wedding
  { id:13, name:"Reception",     emoji:"👑", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:12 },
  { id:14, name:"Vidaai",        emoji:"💐", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:13 },
  { id:15, name:"Griha Pravesh", emoji:"🏠", date:"", time:"", venue:"", status:"upcoming", note:"", colorIdx:14 },
];

export const BUDGET_CATEGORIES = [
  { id:"venue", label:"Venue", emoji:"🏛️", color:"#E53935" },
  { id:"catering", label:"Catering", emoji:"🍽️", color:"#F57C00" },
  { id:"decor", label:"Decor & Flowers", emoji:"🌺", color:"#7B1FA2" },
  { id:"photography", label:"Photography & Video", emoji:"📸", color:"#1565C0" },
  { id:"attire", label:"Attire & Jewelry", emoji:"💍", color:"#C62828" },
  { id:"beauty", label:"Beauty & Grooming", emoji:"💄", color:"#8E24AA" },
  { id:"music", label:"Music & DJ", emoji:"🎵", color:"#00796B" },
  { id:"invites", label:"Invitations", emoji:"💌", color:"#AD1457" },
  { id:"transport", label:"Transport", emoji:"🚌", color:"#4527A0" },
  { id:"stay", label:"Stay & Travel", emoji:"🏨", color:"#00838F" },
  { id:"pandit", label:"Pandit & Rituals", emoji:"🪔", color:"#E65100" },
  { id:"vendors", label:"Vendor Payments", emoji:"🤝", color:"#6D4C41" },
  { id:"misc", label:"Miscellaneous", emoji:"✨", color:"#37474F" },
];

export const EXPENSE_AREAS = [
  { id:"ceremony", label:"Ceremony", emoji:"🪔" },
  { id:"guests", label:"Guests", emoji:"👥" },
  { id:"bride", label:"Bride", emoji:"👰" },
  { id:"groom", label:"Groom", emoji:"🤵" },
  { id:"vendors", label:"Vendors", emoji:"🤝" },
  { id:"general", label:"General", emoji:"✨" },
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
  { id:1, name:"Finalize overall wedding calendar", done:true, due:"6 months before", priority:"high", group:"6 months", eventId:"", ceremony:"General" },
  { id:2, name:"Book main wedding venue", done:true, due:"6 months before", priority:"high", group:"6 months", eventId:9, ceremony:"Pheras" },
  { id:3, name:"Block guest room inventory", done:false, due:"5 months before", priority:"high", group:"5 months", eventId:"", ceremony:"General" },
  { id:4, name:"Freeze photography and video team", done:false, due:"5 months before", priority:"high", group:"5 months", eventId:"", ceremony:"General" },
  { id:5, name:"Finalize Roka guest flow", done:false, due:"4 months before", priority:"medium", group:"4 months", eventId:1, ceremony:"Roka" },
  { id:6, name:"Arrange Sagai ring and stage design", done:false, due:"4 months before", priority:"medium", group:"4 months", eventId:2, ceremony:"Sagai" },
  { id:7, name:"Book haldi floral decor", done:false, due:"3 months before", priority:"high", group:"3 months", eventId:4, ceremony:"Haldi" },
  { id:8, name:"Finalize mehndi artists", done:false, due:"3 months before", priority:"high", group:"3 months", eventId:5, ceremony:"Mehndi" },
  { id:9, name:"Freeze Sangeet choreography slots", done:false, due:"3 months before", priority:"medium", group:"3 months", eventId:6, ceremony:"Sangeet" },
  { id:10, name:"Send invitation cards and e-invites", done:false, due:"2 months before", priority:"high", group:"2 months", eventId:"", ceremony:"General" },
  { id:11, name:"Assign family welcome teams", done:false, due:"2 months before", priority:"medium", group:"2 months", eventId:"", ceremony:"General" },
  { id:12, name:"Finalize baraat transport logistics", done:false, due:"1 month before", priority:"high", group:"1 month", eventId:7, ceremony:"Baraat" },
  { id:13, name:"Confirm jaimala setup and sequence", done:false, due:"1 month before", priority:"medium", group:"1 month", eventId:8, ceremony:"Jaimala" },
  { id:14, name:"Confirm pandit and phera muhurat", done:false, due:"1 month before", priority:"high", group:"1 month", eventId:9, ceremony:"Pheras" },
  { id:15, name:"Prepare kanyadaan rituals checklist", done:false, due:"3 weeks before", priority:"medium", group:"Final", eventId:10, ceremony:"Kanyadaan" },
  { id:16, name:"Finalize saptapadi vow prompts", done:false, due:"3 weeks before", priority:"medium", group:"Final", eventId:11, ceremony:"Saptapadi" },
  { id:17, name:"Arrange sindoor daan items", done:false, due:"2 weeks before", priority:"high", group:"Final", eventId:12, ceremony:"Sindoor Daan" },
  { id:18, name:"Confirm reception stage and MC plan", done:false, due:"2 weeks before", priority:"high", group:"Final", eventId:13, ceremony:"Reception" },
  { id:19, name:"Finalize vidaai vehicle and timing", done:false, due:"1 week before", priority:"high", group:"Final", eventId:14, ceremony:"Vidaai" },
  { id:20, name:"Prepare griha pravesh welcome setup", done:false, due:"1 week before", priority:"medium", group:"Final", eventId:15, ceremony:"Griha Pravesh" },
  { id:21, name:"Print emergency vendor contact sheet", done:false, due:"5 days before", priority:"high", group:"Final", eventId:"", ceremony:"General" },
  { id:22, name:"Pack jewelry and attire day-wise", done:false, due:"4 days before", priority:"high", group:"Final", eventId:"", ceremony:"General" },
  { id:23, name:"Share final timeline with core family", done:false, due:"3 days before", priority:"high", group:"Final", eventId:"", ceremony:"General" },
  { id:24, name:"Settle pending vendor balances", done:false, due:"2 days before", priority:"high", group:"Final", eventId:"", ceremony:"General" },
  { id:25, name:"Create post-event photo backup plan", done:false, due:"After wedding", priority:"low", group:"Post Wedding", eventId:"", ceremony:"General" },
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