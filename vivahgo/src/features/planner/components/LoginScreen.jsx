import GoogleLoginButton from '../../../components/GoogleLoginButton';
import NavIcon from '../../../components/NavIcon';

function LoginScreen({ onGoogleLogin, onDemoLogin, onGoToHome, onLoginError, isLoggingIn, errorMessage, showOauthHelp }) {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <img className="login-logo-image" src="/Thumbnail.png" alt="Vivah GO" />
          </div>
        </div>

        <div className="login-content">
          <div className="login-benefits">
            <div className="benefit-item">
              <span className="benefit-icon"><NavIcon name="events" size={20} /></span>
              <span className="benefit-text">Track your wedding events and guests</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon"><NavIcon name="budget" size={20} /></span>
              <span className="benefit-text">Track budget & expenses</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon"><NavIcon name="guests" size={20} /></span>
              <span className="benefit-text">Find and manage vendors seamlessly</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon"><NavIcon name="tasks" size={20} /></span>
              <span className="benefit-text">Stay organized with tasks and timelines</span>
            </div>
          </div>

          <div className="login-divider">
            <div className="divider-line"></div>
            <span className="divider-text">Login</span>
            <div className="divider-line"></div>
          </div>

          <div className="login-actions">
            <div className="google-login-wrap">
              <GoogleLoginButton onLoginSuccess={onGoogleLogin} onLoginError={onLoginError} />
            </div>
            <button className="login-secondary-btn" type="button" onClick={onDemoLogin} disabled={isLoggingIn}>
              Login as Demo Planner With Sample Data
            </button>
          </div>

          <div className="login-home-section">
            <div className="login-home-divider">
              <div className="divider-line"></div>
              <span className="divider-text">Quick Start</span>
              <div className="divider-line"></div>
            </div>
            <button className="login-home-btn" type="button" onClick={onGoToHome} disabled={isLoggingIn}>
              Go to Home
            </button>
            <button
              className="login-home-btn"
              type="button"
              onClick={() => { window.location.href = '/vendor'; }}
              disabled={isLoggingIn}
              style={{ marginTop: 8 }}
            >
              Login as Vendor
            </button>
          </div>

          {showOauthHelp && (
            <div className="login-oauth-help">
              Use a <strong>Web application</strong> OAuth client, then add <strong>{currentOrigin}</strong> to Authorized JavaScript origins. If you see <strong>invalid_client</strong> or <strong>no registered origin</strong>, the Google Cloud OAuth client is not configured for this frontend origin yet.
            </div>
          )}

          {isLoggingIn && <div className="login-status">Signing you in and loading your planner...</div>}
          {errorMessage && <div className="login-error">{errorMessage}</div>}
        </div>

        <div className="login-footer">
          <p className="login-footer-text">Sign in to continue your wedding planning journey.</p>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
