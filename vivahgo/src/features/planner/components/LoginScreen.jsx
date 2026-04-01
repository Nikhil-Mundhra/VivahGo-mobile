import GoogleLoginButton from '../../../components/GoogleLoginButton';
import EmailOtpLogin from '../../../components/EmailOtpLogin';
import LoadingBar from '../../../components/LoadingBar';
import NavIcon from '../../../components/NavIcon';

function LoginScreen({ onGoogleLogin, onClerkLogin, onDemoLogin, onGoToHome, onLoginError, isLoggingIn, errorMessage, showOauthHelp }) {
  const isClerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const mobileBenefitItems = [
    { icon: 'events', text: 'Track your wedding events and guests' },
    { icon: 'budget', text: 'Track budget & expenses' },
    { icon: 'guests', text: 'Find and manage vendors seamlessly' },
    { icon: 'tasks', text: 'Stay organized with tasks and timelines' },
  ];
  const desktopBenefitItems = [
    { icon: 'events', text: 'Track ceremonies, deadlines, and event details in one place' },
    { icon: 'budget', text: 'Manage your budget with shared visibility across the family' },
    { icon: 'guests', text: 'Coordinate guests, RSVPs, tasks, and vendors without scattered chats' },
    { icon: 'tasks', text: 'Stay on top of every task with a planner built for real wedding logistics' },
  ];

  return (
    <div className="login-screen planner-login-screen">
      <div className="login-container planner-login-container">
        <div className="login-layout">
          <div className="login-hero">
            <div className="login-header">
              <div className="login-logo">
                <a className="login-logo-mark" href="/" aria-label="VivahGo home">
                  <img
                    className="login-logo-image login-logo-image-desktop"
                    src="/header-logo.png"
                    alt="VivahGo"
                    decoding="async"
                    fetchPriority="high"
                  />
                  <img
                    className="login-logo-image login-logo-image-mobile"
                    src="/Thumbnail.png"
                    alt="VivahGo"
                    decoding="async"
                    fetchPriority="high"
                  />
                </a>
              </div>
              <p className="login-kicker">Planner Workspace</p>
              <h1 className="login-title">Plan your wedding with less chaos.</h1>
            </div>
          </div>

          <div className="login-panel">
            <div className="login-panel-card">
              <div className="login-content">
                <div className="login-panel-header">
                  <p className="login-panel-kicker">Sign in to VivahGo</p>
                  <h2 className="login-panel-title">Continue to your planner</h2>
                  <p className="login-panel-subtitle">
                    Access your checklist, guest list, budget, and shared wedding plans.
                  </p>
                </div>

                <div className="login-benefits-mobile">
                  {mobileBenefitItems.map((item) => (
                    <div className="benefit-item" key={`mobile-${item.icon}-${item.text}`}>
                      <span className="benefit-icon"><NavIcon name={item.icon} size={20} /></span>
                      <span className="benefit-text">{item.text}</span>
                    </div>
                  ))}
                </div>

                <div className="login-divider login-home-divider login-divider-mobile">
                  <div className="divider-line"></div>
                  <span className="divider-text">Login</span>
                  <div className="divider-line"></div>
                </div>

                <div className="login-actions">
                  <div className="google-login-wrap">
                    <GoogleLoginButton onLoginSuccess={onGoogleLogin} onLoginError={onLoginError} />
                  </div>
                  {isClerkEnabled && (
                    <>
                      <div style={{ margin: '12px 0', textAlign: 'center', fontSize: '12px', color: '#999' }}>or</div>
                      <EmailOtpLogin onLoginSuccess={onClerkLogin} onLoginError={onLoginError} />
                    </>
                  )}
                  <button className="login-secondary-btn" type="button" onClick={onDemoLogin} disabled={isLoggingIn}>
                    Explore Demo Planner
                  </button>
                </div>

                <div className="login-home-section">
                  <div className="login-home-divider">
                    <div className="divider-line"></div>
                    <span className="divider-text">Other access</span>
                    <div className="divider-line"></div>
                  </div>
                  <button className="login-home-btn" type="button" onClick={onGoToHome} disabled={isLoggingIn}>
                    Back to Home
                  </button>
                  <button
                    className="login-home-btn"
                    type="button"
                    onClick={() => { window.location.href = '/vendor'; }}
                    disabled={isLoggingIn}
                    style={{ marginTop: 10 }}
                  >
                    Vendor Login
                  </button>
                </div>

                {showOauthHelp && (
                  <div className="login-oauth-help">
                    Use a <strong>Web application</strong> OAuth client, then add <strong>{currentOrigin}</strong> to Authorized JavaScript origins. If you see <strong>invalid_client</strong> or <strong>no registered origin</strong>, the Google Cloud OAuth client is not configured for this frontend origin yet.
                  </div>
                )}

                {isLoggingIn && (
                  <div className="login-status">
                    <div>Signing you in and loading your planner...</div>
                    <LoadingBar compact className="login-status-loading-bar" />
                  </div>
                )}
                {errorMessage && <div className="login-error">{errorMessage}</div>}

                <div className="login-footer login-footer-mobile">
                  <p className="login-footer-text">Sign in to continue your wedding planning journey.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="login-support">
            <div className="login-benefits">
              {desktopBenefitItems.map((item) => (
                <div className="benefit-item" key={`desktop-${item.icon}-${item.text}`}>
                  <span className="benefit-icon"><NavIcon name={item.icon} size={20} /></span>
                  <span className="benefit-text">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
