import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

const REQUESTED_SCOPES = [
  'openid',
  'https://www.googleapis.com',
  'https://www.googleapis.com',
].join(' ');

function GoogleLoginButton({ onLoginSuccess, onLoginError }) {
  const handleSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);

      const userInfo = {
        id: decoded.sub,
        name: decoded.name,
        email: decoded.email,
        picture: decoded.picture,
      };

      onLoginSuccess(userInfo);
    } catch (error) {
      console.error('Failed to decode Google credential:', error);
      onLoginError?.(error);
    }
  };

  const handleError = () => {
    const error = new Error('Google login failed');
    onLoginError?.(error);
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={handleError}
      scope={REQUESTED_SCOPES}
      size="large"
      text="continue_with"
      shape="rectangular"
      theme="outline"
      width="280"
    />
  );
}

export default GoogleLoginButton;