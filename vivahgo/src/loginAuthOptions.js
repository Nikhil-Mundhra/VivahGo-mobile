const LOGIN_AUTH_OPTION_BINDERS = {
  google: function bindGoogle(option, handlers) {
    return {
      ...option,
      onLoginSuccess: handlers.onGoogleLogin,
      onLoginError: handlers.onLoginError,
    };
  },
  'clerk-social': function bindClerkSocial(option, handlers) {
    return {
      ...option,
      onLoginError: handlers.onLoginError,
      disabled: handlers.isLoggingIn,
    };
  },
  'email-otp': function bindEmailOtp(option, handlers) {
    return {
      ...option,
      onLoginSuccess: handlers.onClerkLogin,
      onLoginError: handlers.onLoginError,
    };
  },
};

const DEFAULT_LOGIN_AUTH_OPTIONS = Object.freeze([
  { id: 'google', type: 'google' },
  {
    id: 'facebook',
    type: 'clerk-social',
    strategy: 'oauth_facebook',
    label: 'Continue with Facebook',
    requiresClerk: true,
  },
  {
    id: 'email',
    type: 'email-otp',
    requiresClerk: true,
    separatorBeforeLabel: 'or',
  },
]);

export function buildLoginAuthOptions(handlers, options = {}) {
  const isClerkEnabled = Boolean(options.isClerkEnabled);
  const hiddenOptionIds = Array.isArray(options.hiddenOptionIds) ? new Set(options.hiddenOptionIds) : null;

  return DEFAULT_LOGIN_AUTH_OPTIONS
    .filter((option) => !option.requiresClerk || isClerkEnabled)
    .filter((option) => !hiddenOptionIds || !hiddenOptionIds.has(option.id))
    .map((option) => {
      const bindOption = LOGIN_AUTH_OPTION_BINDERS[option.type];
      return bindOption ? bindOption(option, handlers) : option;
    });
}