import { useEffect, useRef } from 'react';
import { COLORS } from '../constants';

function GoogleLogin({ onSuccess, onError }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    // Load Google Identity Services script if not already loaded
    if (!window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = () => {
        initializeGoogleSignIn();
      };
    } else {
      initializeGoogleSignIn();
    }

    function initializeGoogleSignIn() {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        window.google.accounts.id.renderButton(
          buttonRef.current,
          {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: '280',
          }
        );
      }
    }

    function handleCredentialResponse(response) {
      try {
        // Decode the JWT token to get user info
        const responsePayload = decodeJwtResponse(response.credential);

        const userInfo = {
          id: responsePayload.sub,
          email: responsePayload.email,
          name: responsePayload.name,
          picture: responsePayload.picture,
          given_name: responsePayload.given_name,
          family_name: responsePayload.family_name,
        };

        // Store user info in localStorage
        localStorage.setItem('user', JSON.stringify(userInfo));
        localStorage.setItem('isLoggedIn', 'true');

        onSuccess(userInfo);
      } catch (error) {
        console.error('Error processing Google login:', error);
        onError && onError(error);
      }
    }

    function decodeJwtResponse(token) {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    }
  }, [onSuccess, onError]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <div
        ref={buttonRef}
        style={{
          width: '280px',
          height: '40px',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      />
      <div style={{
        fontSize: '12px',
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        maxWidth: '280px',
        lineHeight: '1.4'
      }}>
        By continuing, you agree to our Terms of Service and Privacy Policy
      </div>
    </div>
  );
}

export default GoogleLogin;