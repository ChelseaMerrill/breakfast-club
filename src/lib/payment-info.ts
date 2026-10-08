// How sponsors pay Chelsea (open-questions #53). The app only tracks Paid / not paid; the
// money itself goes to Chelsea in cash or on Venmo.

export const VENMO_HANDLE = "@Chelsea-Merrill-1";
export const VENMO_URL = "https://venmo.com/u/Chelsea-Merrill-1";

/** "cash or Venmo @Chelsea-Merrill-1" — for sentences like "Pay Chelsea $30 by …". */
export const PAYMENT_METHODS = `cash or Venmo ${VENMO_HANDLE}`;
