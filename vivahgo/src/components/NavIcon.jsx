import React from 'react';

const ICON_PATHS = {
  home: (
    <path d="M4.75 10.25 12 4.5l7.25 5.75V19a.75.75 0 0 1-.75.75h-4.25v-5.5h-4.5v5.5H5.5A.75.75 0 0 1 4.75 19v-8.75Z" />
  ),
  events: (
    <>
      {/* Main Calendar Body - Maximized to edges (x:2 to 22) */}
      <rect x="2" y="5" width="20" height="16" rx="2" />
      
      {/* Top 'Binding' Bar */}
      <path d="M2 9h20" />
      
      {/* Calendar Rings/Hooks */}
      <path d="M7 3v4M17 3v4" />
      
      {/* The 'Event' Marker: A solid 'Day' in the center */}
      <rect x="8" y="12" width="8" height="6" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  budget: (
    <>
      {/* Top horizontal bar */}
      <path d="M6 5h12" />
      
      {/* Middle horizontal bar */}
      <path d="M6 9h12" />
      
      {/* The main 'R' curve and leg: starts from the middle bar, 
          curves around, and slashes down */}
      <path d="M10 5c4 0 6 2 6 4s-2 4-6 4h-2l7 7" />
    </>
  ),
  guests: (
    <g strokeLinejoin="round">
      {/* Left Person - Head lowered to cy=12.5, Body at y=21 */}
      <circle cx="4.5" cy="12.5" r="3" />
      <path d="M0.5 21c0-2.5 2-4.5 4-4.5s4 2 4 4.5" />
      
      {/* Right Person - Head lowered to cy=12.5, Body at y=21 */}
      <circle cx="19.5" cy="12.5" r="3" />
      <path d="M15.5 21c0-2.5 2-4.5 4-4.5s4 2 4 4.5" />
      
      {/* Center Person - Head lowered to cy=10, Body widened and solid */}
      <g fill="currentColor">
        <circle cx="12" cy="10" r="3.8" />
        <path d="M6 22c0-3.2 2.7-5.8 6-5.8s6 2.6 6 5.8H6z" />
      </g>
    </g>
  ),
  vendors: (
    <>
      {/* Main Bag Body - Centered at x=12 */}
      <rect x="3" y="7" width="18" height="14" rx="2" />
      
      {/* Centered Handle: 
          Starts at x=9, curves up 2 units, peaks, and ends at x=15 */}
      <path d="M9 7V5.5a3 3 0 0 1 6 0V7" />
      
      {/* Centered Tag */}
      <rect x="10" y="11" width="4" height="4" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  tasks: (
    <>
      {/* Horizontal lines - starting at 9 to give checkmarks more room */}
      <path d="M9 7h12" />
      <path d="M9 12h12" />
      <path d="M9 17h12" />
      
      {/* Longer, more aggressive checkmarks */}
      {/* Each one starts at x=3, dips to x=5, and kicks up to x=7.5 */}
      <path d="m3 7 2 2 2.5-4" />
      <path d="m3 12 2 2 2.5-4" />
      <path d="m3 17 2 2 2.5-4" />
    </>
  ),
};

export default function NavIcon({ 
  name, 
  className = "", 
  size = 24, 
  strokeWidth = 1.8 
}) {
  const icon = ICON_PATHS[name];

  if (!icon) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}