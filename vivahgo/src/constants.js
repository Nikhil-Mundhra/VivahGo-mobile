export const COLORS = {
  crimson: "#8B1A1A",
  deepRed: "#6B0F0F",
  brightRed: "#C41E3A",
  gold: "#D4AF37",
  goldLight: "#F0D060",
  goldDark: "#A8860C",
  ivory: "#FFF8E7",
  ivoryDark: "#F5ECD7",
  cream: "#FEFAF0",
  white: "#FFFFFF",
  darkText: "#2C1010",
  midText: "#5C3030",
  lightText: "#8B6060",
};

export const EVENT_COLORS = [
  ["#F4A582","#F4A582"],  // 0  Roka                  – marigold amber
  ["#FFC5D3","#FFC5D3"],  // 1  Sagai/Ring Ceremony   – pink
  ["#FFB347","#FFB347"],  // 2  Ganesh Puja           – deep saffron
  ["#E7DB59","#E7DB59"],  // 3  Haldi                 – turmeric light yellow
  ["#708238","#4A7C38"],  // 4  Mehndi                – mehndi light green
  ["#E6A8D7","#E6A8D7"],  // 5  Sangeet               – royal purple
  ["#FF9AA2","#FF9AA2"],  // 6  Baraat                – dark maroon
  ["#E6A8D7","#E6A8D7"],  // 7  Jaimala               – floral red
  ["#F8DE7E","#F8DE7E"],  // 8  Pheras                – sacred fire
  ["#EF6C00","#BA4A00"],  // 9  Kanyadaan             – warm amber
  ["#C5E1A5","#C5E1A5"],  // 10 Saptapadi             – forest green
  ["#880E4F","#560027"],  // 11 Sindoor Daan          – sindoor crimson
  ["#77DDDD","#77DDDD"],  // 12 Reception             – royal blue
  ["#EAE0C8","#EAE0C8"],  // 13 Vidaai                – rose pink
  ["#D84315","#BF360C"],  // 14 Griha Pravesh         – terracotta
];

export const VENDOR_TYPES = [
  "All",
  "Venue",
  "Photography",
  "Catering",
  "Wedding Invitations",
  "Wedding Gifts",
  "Music",
  "Wedding Transportation",
  "Tent House",
  "Wedding Entertainment",
  "Florists",
  "Wedding Planners",
  "Wedding Videography",
  "Honeymoon",
  "Wedding Decorators",
  "Wedding Cakes",
  "Wedding DJ",
  "Pandit",
  "Photobooth",
  "Astrologers",
  "Party Places",
  "Choreographer",
  "Bridal & Pre-Bridal",
  "Groom Services",
];

export const BUNDLED_SERVICE_OPTIONS = VENDOR_TYPES.filter(type => type !== "All" && type !== "Honeymoon");

export const VENDOR_SUBTYPE_OPTIONS = {
  Venue: [
    "Wedding Lawns",
    "Farmhouses",
    "Hotels",
    "Banquet Halls",
    "Marriage Garden",
    "Kalyana Mandapams",
    "Wedding Resorts",
  ],
  "Wedding Transportation": [
    "Guest Transport",
    "Airport Transfers",
    "Luxury Cars",
    "Baraat Entry Vehicles",
  ],
  "Wedding Entertainment": [
    "Live Performers",
    "Celebrity Acts",
    "Anchors / MC",
    "Baraat Entertainment",
  ],
  Music: [
    "Live Band",
    "Dhol",
    "Sufi Night",
    "Instrumental Ensemble",
  ],
  "Wedding Invitations": [
    "Luxury Box Invitations",
    "Digital E-Invites",
    "Traditional Cards",
    "Invitation Hampers",
  ],
  "Wedding Gifts": [
    "Guest Hampers",
    "Shagun Gifts",
    "Bridesmaid Gifts",
    "Corporate Gifting",
  ],
  Florists: [
    "Varmala Florals",
    "Fresh Venue Florals",
    "Car Florals",
    "Table Arrangements",
  ],
  "Wedding Planners": [
    "Full Planning",
    "Partial Planning",
    "Wedding Coordination",
    "Destination Wedding Planning",
  ],
  "Wedding Videography": [
    "Cinematic Wedding Films",
    "Teaser Reels",
    "Documentary Coverage",
    "Drone Videography",
  ],
  "Wedding Decorators": [
    "Mandap Decor",
    "Floral Decor",
    "Stage Decor",
    "Theme Decor",
  ],
  "Wedding Cakes": [
    "Tiered Wedding Cakes",
    "Dessert Tables",
    "Fondant Cakes",
    "Eggless Cakes",
  ],
  "Wedding DJ": [
    "Sangeet DJ",
    "Cocktail DJ",
    "After Party DJ",
    "Sound & Lights",
  ],
  Pandit: [
    "Wedding Pandit",
    "Phera Specialist",
    "South Indian Priest",
    "Samagri Guidance",
  ],
  Photobooth: [
    "Instant Print Booth",
    "GIF Booth",
    "Mirror Booth",
    "360 Video Booth",
  ],
  Astrologers: [
    "Kundli Matching",
    "Muhurat Consultation",
    "Remedy Guidance",
    "Online Consultation",
  ],
  "Party Places": [
    "Cocktail Venues",
    "Rooftop Venues",
    "Private Dining",
    "After Party Spaces",
  ],
  Choreographer: [
    "Couple Choreography",
    "Family Performances",
    "Sangeet Concepts",
    "At-Home Rehearsals",
  ],
  "Bridal & Pre-Bridal": [
    "Bridal Jewellery",
    "Bridal Makeup Artists",
    "Bridal Lehenga",
    "Mehndi Artists",
    "Makeup Salon",
    "Trousseau Packing",
  ],
  "Groom Services": [
    "Sherwani",
    "Salon",
  ],
};

// WhatsApp customer support number (country code + number, no + or spaces)
export const WHATSAPP_SUPPORT_NUMBER = "918383874103";

export const FEEDBACK_APP_VERSION = "1.0.0";

export const NAV_ITEMS = [
  {id:"home",icon:"home",label:"Home"},
  {id:"events",icon:"events",label:"Events"},
  {id:"budget",icon:"budget",label:"Budget"},
  {id:"guests",icon:"guests",label:"Guests"},
  {id:"vendors",icon:"vendors",label:"Vendors"},
  {id:"tasks",icon:"tasks",label:"Tasks"},
];
