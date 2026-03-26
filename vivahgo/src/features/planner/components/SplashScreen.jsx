import { useState, useEffect } from "react";
import Mandala from "../../../components/Mandala";

function SplashScreen({ onStart, onSkip, showSkip = false }) {
  const [show, setShow] = useState(false);
  useEffect(()=>{ setTimeout(()=>setShow(true),200); },[]);
  return (
    <div className="splash">
      <Mandala size={500} style={{position:"absolute",top:-50,left:-50,className:"splash-mandala"}} className="splash-mandala"/>
      <Mandala size={400} style={{position:"absolute",bottom:-80,right:-80,opacity:0.05,animation:"rotateSlow 60s linear infinite reverse"}}/>
      <div className="splash-content" style={{opacity:show?1:0,transition:"opacity 0.8s ease, transform 0.8s ease",transform:show?"translateY(0)":"translateY(30px)"}}>
        <div className="splash-diya">🪔</div>
        <div className="splash-title">Vivah Go</div>
        <div className="splash-title" style={{fontSize:24,marginTop:-6,color:"white",fontWeight:300,letterSpacing:2}}>Wedding Planner</div>
        <div className="splash-subtitle">Plan your perfect shaadi</div>
        <div className="splash-divider">
          <div className="splash-divider-line"/>
          <div className="splash-divider-diamond"/>
          <div className="splash-divider-line"/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
          <button className="btn-primary" style={{width:240,background:"linear-gradient(135deg, #D4AF37, #A8860C)",color:"#3D0000",fontSize:16,letterSpacing:0.5}} onClick={onStart}>
            Begin Your Journey ✨
          </button>
          {showSkip && (
            <button
              type="button"
              className="splash-skip-btn"
              onClick={onSkip}
            >
              Skip for now, start with blank template
            </button>
          )}
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:12,marginTop:4}}>Powered by VivahGo AI</p>
        </div>
      </div>
      <div style={{position:"absolute",bottom:40,left:0,right:0,textAlign:"center"}}>
        <div className="ornament">✦ ✦ ✦</div>
        <p style={{color:"rgba(255,255,255,0.3)",fontSize:11,marginTop:4}}>Shubh Vivah</p>
      </div>
    </div>
  );
}

export default SplashScreen;
