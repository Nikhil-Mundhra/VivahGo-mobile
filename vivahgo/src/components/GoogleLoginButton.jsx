import { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';

function GoogleLoginButton({ onLoginSuccess, onLoginError }) {
  const buttonWrapRef = useRef(null);
  const [buttonWidth, setButtonWidth] = useState(280);

  useEffect(() => {
    const container = buttonWrapRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const updateWidth = () => {
      const nextWidth = Math.floor(container.getBoundingClientRect().width);
      const clamped = Math.max(220, Math.min(400, nextWidth));
      setButtonWidth(clamped);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    return (
      <div ref={buttonWrapRef} className="google-button-inner-wrap">
        <button className="login-secondary-btn" type="button" disabled>
          Add VITE_GOOGLE_CLIENT_ID to enable Google sign-in
        </button>
      </div>
    );
  }

  const handleSuccess = (credentialResponse) => {
    onLoginSuccess(credentialResponse);
  };

  const handleError = () => {
    const error = new Error('Google login failed');
    onLoginError?.(error);
  };

  return (
    <div ref={buttonWrapRef} className="google-button-inner-wrap">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        size="large"
        text="continue_with"
        shape="rectangular"
        theme="outline"
        logo_alignment="center"
        width={String(buttonWidth)}
      />
    </div>
  );
}

export default GoogleLoginButton;