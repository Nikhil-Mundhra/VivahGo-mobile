import GoogleLoginButton from './GoogleLoginButton';

function LoginScreen({ onLoginSuccess, onLoginError }) {
  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">💍</div>
          <h1 className="login-title">Welcome to VivahGo</h1>
          <p className="login-subtitle">Your personal wedding planning assistant</p>
        </div>

        <div className="login-content">
          <div className="login-benefits">
            <div className="benefit-item">
              <span className="benefit-icon">📅</span>
              <span className="benefit-text">Plan your perfect wedding</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">💰</span>
              <span className="benefit-text">Track budget & expenses</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">👥</span>
              <span className="benefit-text">Manage guests & vendors</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">✅</span>
              <span className="benefit-text">Stay organized with tasks</span>
            </div>
          </div>

          <div className="login-divider">
            <div className="divider-line"></div>
            <span className="divider-text">Continue with</span>
            <div className="divider-line"></div>
          </div>

          <GoogleLoginButton onLoginSuccess={onLoginSuccess} onLoginError={onLoginError} />
        </div>

        <div className="login-footer">
          <p className="login-footer-text">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;