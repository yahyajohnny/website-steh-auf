/**
 * API-Keys hier eintragen (nicht mit echten Keys ins Repo committen).
 */
window.STEH_AUF_CONFIG = {
  vivenuApiKey: 'key_2e156fccc7d21024bab8f09beeb82631b6ea728030bdac5d2f9844eaf0e147158bad59c57a3e5b707b44243d6d602da4',
  eventbriteToken: '7VRDXWOGCDMMXWOOBXWH',
  vivenuSellerIds: [],
  vivenuStrictFilter: false,

  /**
   * CleverReach Newsletter
   * Standard: POST an api/newsletter.php (REST-API, Double-Opt-In)
   * Alternative: formAction aus CleverReach-Quellcode setzen (dann kein PHP nötig)
   */
  cleverReach: {
    apiUrl: 'api/newsletter.php',
    formAction: '',
    hiddenFields: {}
  }
};
