export function validateOnboardingAnswer(key, value) {
  const trimmedValue = value.trim();

  switch (key) {
    case "bride":
    case "groom":
    case "venue": {
      if (!trimmedValue) {
        return { isValid: false, message: "This field cannot be empty. Please provide an answer." };
      }
      if (trimmedValue.length < 2) {
        return { isValid: false, message: "Please enter at least 2 characters." };
      }
      return { isValid: true };
    }

    case "date": {
      if (!trimmedValue) {
        return { isValid: false, message: "Please enter a wedding date." };
      }
      const date = new Date(trimmedValue);
      if (isNaN(date.getTime())) {
        return { isValid: false, message: "Please enter a valid date format (e.g., '25 November 2025' or '2025-11-25')." };
      }
      const now = new Date();
      if (date <= now) {
        return { isValid: false, message: "Please enter a future date for your wedding." };
      }
      return { isValid: true };
    }

    case "guests": {
      if (!trimmedValue) {
        return { isValid: false, message: "Please enter the expected number of guests." };
      }
      const guestNum = parseInt(trimmedValue.replace(/,/g, ""));
      if (isNaN(guestNum) || guestNum <= 0) {
        return { isValid: false, message: "Please enter a valid number of guests (e.g., 300)." };
      }
      if (guestNum > 2000) {
        return { isValid: false, message: "Please enter a realistic number of guests (under 2000)." };
      }
      return { isValid: true };
    }

    case "budget": {
      if (!trimmedValue) {
        return { isValid: false, message: "Please enter your wedding budget." };
      }
      const cleanBudget = trimmedValue.replace(/[₹,\s]/g, "");
      const budgetNum = parseFloat(cleanBudget);
      if (isNaN(budgetNum) || budgetNum <= 0) {
        return { isValid: false, message: "Please enter a valid budget amount (e.g., '50,00,000' or '500000')." };
      }
      if (budgetNum < 10000) {
        return { isValid: false, message: "Please enter a realistic budget amount (minimum ₹10,000)." };
      }
      return { isValid: true };
    }

    default:
      return { isValid: true };
  }
}
